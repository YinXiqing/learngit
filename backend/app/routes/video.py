import os, re, uuid, asyncio, aiofiles
from app.logger import logger
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, or_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import aiohttp
from app.deps import get_db, get_current_user, get_optional_user
from app.models import Video, User
from config import settings

router = APIRouter(prefix="/api/video", tags=["video"])

def _ext(fn): return fn.rsplit(".", 1)[-1].lower() if "." in fn else ""

async def _get_duration(path) -> int:
    try:
        loop = asyncio.get_running_loop()
        def _run():
            import subprocess, json
            r = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                capture_output=True, text=True, timeout=10
            )
            return int(float(json.loads(r.stdout)["format"]["duration"]))
        return await loop.run_in_executor(None, _run)
    except Exception:
        return 0

async def _extract_cover(video_path, cover_filename) -> bool:
    try:
        loop = asyncio.get_running_loop()
        def _run():
            import subprocess
            r = subprocess.run(
                ["ffmpeg", "-y", "-i", str(video_path), "-ss", "00:00:01",
                 "-vframes", "1", "-q:v", "2", str(settings.UPLOAD_FOLDER / cover_filename)],
                capture_output=True, timeout=15
            )
            return r.returncode == 0
        return await loop.run_in_executor(None, _run)
    except Exception:
        return False

async def _transcode_hls(video_id: int, src_path):
    """后台异步将视频转码为 HLS"""
    try:
        import subprocess
        from app.database import AsyncSessionLocal
        hls_dir = settings.UPLOAD_FOLDER / "hls" / str(video_id)
        hls_dir.mkdir(parents=True, exist_ok=True)
        m3u8_path = hls_dir / "index.m3u8"
        loop = asyncio.get_running_loop()
        is_mp4 = str(src_path).lower().endswith(".mp4")
        def _run():
            codec_args = ["-codec:", "copy"] if is_mp4 else ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"]
            r = subprocess.run([
                "ffmpeg", "-y", "-i", str(src_path),
                *codec_args,
                "-start_number", "0",
                "-hls_time", "10",
                "-hls_list_size", "0",
                "-hls_segment_filename", str(hls_dir / "seg%03d.ts"),
                "-f", "hls", str(m3u8_path)
            ], capture_output=True, timeout=600)
            return r.returncode == 0
        ok = await loop.run_in_executor(None, _run)
        async with AsyncSessionLocal() as db:
            await db.execute(update(Video).where(Video.id == video_id).values(hls_ready=ok))
            await db.commit()
        if ok:
            logger.info("hls_ready", video_id=video_id)
        else:
            logger.warning("hls_transcode_failed", video_id=video_id)
    except Exception as e:
        logger.error("hls_transcode_error", video_id=video_id, error=str(e))


async def _delete_video_files(video: Video):
    """删除视频关联的本地文件（跳过外链）"""
    loop = asyncio.get_running_loop()
    for f in [video.filename, video.cover_image]:
        if f and not f.startswith("http"):
            p = settings.UPLOAD_FOLDER / f
            if p.exists():
                await loop.run_in_executor(None, p.unlink)
    # 清理 HLS 目录
    hls_dir = settings.UPLOAD_FOLDER / "hls" / str(video.id)
    if hls_dir.exists():
        import shutil
        await loop.run_in_executor(None, shutil.rmtree, hls_dir)


async def _delete_video(db: AsyncSession, video: Video):
    """删除视频：本地文件 + scraped记录 + watch_history + 数据库记录"""
    from sqlalchemy import delete as sa_delete
    from app.models import ScrapedVideoInfo, WatchHistory
    await _delete_video_files(video)
    await db.execute(sa_delete(ScrapedVideoInfo).where(ScrapedVideoInfo.video_id == video.id))
    if video.page_url:
        await db.execute(sa_delete(ScrapedVideoInfo).where(ScrapedVideoInfo.source_url == video.page_url))
    await db.execute(sa_delete(WatchHistory).where(WatchHistory.video_id == video.id))
    await db.delete(video)


async def _check_url(url):
    try:
        async with aiohttp.ClientSession() as s:
            async with s.head(url, timeout=aiohttp.ClientTimeout(total=5), ssl=False) as r:
                return r.status < 400
    except Exception:
        return False

async def _get_fresh_url(page_url: str) -> tuple[str, dict]:
    """返回 (video_url, http_headers)"""
    if not page_url:
        return "", {}
    try:
        import yt_dlp
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or ""
        cookies_file = os.environ.get("YTDLP_COOKIES_FILE") or ""
        ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True, "socket_timeout": 20}
        if proxy: ydl_opts["proxy"] = proxy
        if cookies_file and os.path.exists(cookies_file): ydl_opts["cookiefile"] = cookies_file
        def _run():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(page_url, download=False)
            fmts = info.get("formats", [])
            m3u8 = [f for f in fmts if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("url") and f.get("vcodec") != "none"]
            direct = [f for f in fmts if f.get("url") and f.get("vcodec") not in (None, "none")]
            best = (max(m3u8, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if m3u8
                    else max(direct, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if direct
                    else {})
            url = best.get("url") or info.get("url", "")
            if url.endswith(".m3u") and not url.endswith(".m3u8"): url += "8"
            headers = dict(best.get("http_headers") or {})
            if page_url not in headers.get("Referer", ""):
                headers["Referer"] = page_url
            return url, headers
        return await asyncio.get_running_loop().run_in_executor(None, _run)
    except Exception:
        return "", {}

async def _refresh_url_bg(video_id, page_url):
    try:
        import json
        from app.database import AsyncSessionLocal
        new_url, new_headers = await _get_fresh_url(page_url)
        if new_url:
            async with AsyncSessionLocal() as db:
                await db.execute(update(Video).where(Video.id == video_id).values(
                    source_url=new_url,
                    http_headers=json.dumps(new_headers) if new_headers else None
                ))
                await db.commit()
    except Exception as e:
        logger.warning("url_refresh_failed", video_id=video_id, error=str(e))

BLOCKED = re.compile(r"^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)", re.I)

# 未登录用户播放量去重：{(ip, video_id): timestamp}
_ip_view_cache: dict[tuple, float] = {}

# 上传防重复：{(user_id, content_hash): timestamp}
_upload_cache: dict[tuple, float] = {}


@router.get("/list")
async def list_videos(page: int = 1, per_page: int = 12, search: str = "", tag: str = "",
                      sort: str = "newest", status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(Video).options(selectinload(Video.author_rel))
    q = q.where(Video.status == status) if status else q.where(Video.status == "approved")
    if search:
        pat = f"%{search}%"
        q = q.join(User).where(or_(Video.title.ilike(pat), User.username.ilike(pat)))
    if tag:
        q = q.where(Video.tags.ilike(f"%{tag}%"))
    order = Video.view_count.desc() if sort == "popular" else Video.created_at.asc() if sort == "oldest" else Video.created_at.desc()
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.order_by(order).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


@router.get("/detail/{video_id}")
async def get_video_detail(video_id: int, db: AsyncSession = Depends(get_db),
                           user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id, options=[selectinload(Video.author_rel)])
    if not video:
        raise HTTPException(404, "Video not found")
    if video.status != "approved":
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(404, "Video not found")
    if video.is_scraped and video.page_url and video.source_url:
        if not await _check_url(video.source_url):
            asyncio.create_task(_refresh_url_bg(video_id, video.page_url))
    return {"video": video.to_dict()}


@router.get("/stream/{video_id}")
async def stream_video(request: Request, video_id: int, db: AsyncSession = Depends(get_db),
                       user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403, "Access denied")
    from datetime import datetime, timedelta, timezone
    from app.models import WatchHistory
    import time
    should_count = True
    if user:
        recent = (await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.video_id == video_id,
                WatchHistory.watched_at >= datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
            )
        )).scalars().first()
        if recent:
            should_count = False
    else:
        ip = request.client.host if request.client else "unknown"
        key = (ip, video_id)
        now = time.time()
        if key in _ip_view_cache and now - _ip_view_cache[key] < 3600:
            should_count = False
        else:
            _ip_view_cache[key] = now
            # 顺便清理过期条目，避免内存无限增长
            if len(_ip_view_cache) > 10000:
                cutoff = now - 3600
                for k in [k for k, v in _ip_view_cache.items() if v < cutoff]:
                    del _ip_view_cache[k]
    if should_count:
        await db.execute(update(Video).where(Video.id == video_id).values(view_count=Video.view_count + 1))
        await db.commit()
    # HLS 就绪时返回 m3u8
    if video.hls_ready:
        return {"is_hls": True, "video_url": f"/api/video/hls/{video_id}/index.m3u8"}
    # 回退：直接播放原始文件
    if not video.is_scraped:
        path = settings.UPLOAD_FOLDER / video.filename
        if path.exists():
            return {"is_hls": False, "video_url": f"/api/video/file/{video_id}"}
    raise HTTPException(503, "视频正在处理中，请稍后再试")


@router.get("/file/{video_id}")
async def serve_file(video_id: int, db: AsyncSession = Depends(get_db),
                     user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video or video.is_scraped:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / video.filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="video/mp4")



@router.get("/hls/{video_id}/{filename}")
async def serve_hls(video_id: int, filename: str, db: AsyncSession = Depends(get_db),                    user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video or not video.hls_ready:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / "hls" / str(video_id) / filename
    if not path.exists():
        raise HTTPException(404)
    ct = "application/vnd.apple.mpegurl" if filename.endswith(".m3u8") else "video/mp2t"
    return FileResponse(path, media_type=ct)


@router.get("/cover/{video_id}")
async def get_cover(video_id: int, db: AsyncSession = Depends(get_db)):
    video = await db.get(Video, video_id)
    if not video or not video.cover_image:
        raise HTTPException(404)
    if video.cover_image.startswith("http"):
        # 代理外链封面，避免防盗链问题
        async def _gen():
            try:
                referer = video.page_url or video.cover_image
                async with aiohttp.ClientSession() as s:
                    async with s.get(video.cover_image,
                                     headers={"User-Agent": "Mozilla/5.0", "Referer": referer},
                                     ssl=False, timeout=aiohttp.ClientTimeout(total=10)) as r:
                        if r.status >= 400:
                            return
                        async for chunk in r.content.iter_chunked(8192):
                            yield chunk
            except Exception:
                return
        ct = "image/jpeg"
        if video.cover_image.split("?")[0].endswith(".png"): ct = "image/png"
        elif video.cover_image.split("?")[0].endswith(".webp"): ct = "image/webp"
        return StreamingResponse(_gen(), media_type=ct)
    path = settings.UPLOAD_FOLDER / video.cover_image
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


@router.post("/upload", status_code=201)
async def upload_video(title: str = Form(...), description: str = Form(""), tags: str = Form(""),
                       video: UploadFile = File(...), cover: Optional[UploadFile] = File(None),
                       db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # 验证扩展名
    if _ext(video.filename) not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, "Invalid video format")
    
    # 读取并验证视频文件
    content = await video.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")

    # 防重复提交：同一用户 5 分钟内相同文件拒绝
    import hashlib, time as _time
    content_hash = hashlib.md5(content[:1024 * 1024]).hexdigest()  # 只 hash 前 1MB，够快
    dedup_key = (user.id, content_hash)
    _now = _time.time()
    if dedup_key in _upload_cache and _now - _upload_cache[dedup_key] < 300:
        raise HTTPException(429, "请勿重复提交，5 分钟内已上传相同文件")
    _upload_cache[dedup_key] = _now
    
    # 读取并验证封面图片
    cover_content = None
    if cover and cover.filename:
        if _ext(cover.filename) not in settings.ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(400, "Invalid cover image format")
        cover_content = await cover.read()
        if len(cover_content) > 10 * 1024 * 1024:  # 10MB 限制
            raise HTTPException(413, "Cover image too large")
    
    # 所有验证通过后再保存文件
    filename = f"{uuid.uuid4().hex}.{_ext(video.filename)}"
    async with aiofiles.open(settings.UPLOAD_FOLDER / filename, "wb") as f:
        await f.write(content)

    cover_filename = None
    video_path = settings.UPLOAD_FOLDER / filename
    if cover_content:
        cover_filename = f"cover_{uuid.uuid4().hex}.{_ext(cover.filename)}"
        async with aiofiles.open(settings.UPLOAD_FOLDER / cover_filename, "wb") as f:
            await f.write(cover_content)
        duration = await _get_duration(video_path)
    else:
        auto_cover = f"cover_{uuid.uuid4().hex}.jpg"
        duration, cover_ok = await asyncio.gather(
            _get_duration(video_path),
            _extract_cover(video_path, auto_cover)
        )
        if cover_ok:
            cover_filename = auto_cover

    # 数据库写入失败时清理已写入的文件，保证一致性
    try:
        record = Video(title=title.strip(), description=description.strip(), tags=tags.strip(),
                       filename=filename, cover_image=cover_filename, file_size=len(content),
                       duration=duration,
                       user_id=user.id, status="pending")
        db.add(record)
        await db.commit()
        await db.refresh(record)
    except Exception:
        for f in [filename, cover_filename]:
            if f:
                p = settings.UPLOAD_FOLDER / f
                if p.exists(): p.unlink()
        raise HTTPException(500, "Upload failed, please try again")
    response = {"message": "Video uploaded successfully. Awaiting admin approval.", "video": record.to_dict()}
    # 后台异步转码（不阻塞响应）
    asyncio.create_task(_transcode_hls(record.id, settings.UPLOAD_FOLDER / filename))
    return response


@router.get("/refresh-url/{video_id}")
async def refresh_video_url(video_id: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    import json
    video = await db.get(Video, video_id)
    if not video or not video.is_scraped or not video.page_url:
        return {"video_url": video.source_url if video else None}
    new_url, new_headers = await _get_fresh_url(video.page_url)
    if new_url:
        await db.execute(update(Video).where(Video.id == video_id).values(
            source_url=new_url,
            http_headers=json.dumps(new_headers) if new_headers else video.http_headers
        ))
        await db.commit()
    return {"video_url": new_url or video.source_url}


@router.get("/proxy")
async def proxy_stream(url: str, referer: str = "", db: AsyncSession = Depends(get_db)):
    from urllib.parse import urlparse, urljoin, urlunparse
    import json
    try:
        p = urlparse(url)
        if not p.hostname or BLOCKED.match(p.hostname) or p.scheme not in ("http", "https"):
            raise HTTPException(403, "Blocked")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Invalid URL")

    # 查找匹配的视频，获取存储的 http_headers
    stored_headers: dict = {}
    try:
        video = (await db.execute(select(Video).where(Video.source_url == url))).scalars().first()
        if video and video.http_headers:
            stored_headers = json.loads(video.http_headers)
    except Exception:
        pass

    effective_referer = referer or stored_headers.get("Referer") or f"{p.scheme}://{p.netloc}/"
    user_agent = stored_headers.get("User-Agent") or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"

    req_headers = {**stored_headers, "Referer": effective_referer, "User-Agent": user_agent, "Origin": f"{p.scheme}://{p.netloc}"}

    async def _gen():
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(url, headers=req_headers, ssl=False) as r:
                    if r.status >= 400:
                        return
                    ct = r.headers.get("Content-Type", "")
                    if "m3u8" in ct or ".m3u8" in url:
                        text = await r.text()
                        base = urlunparse((p.scheme, p.netloc, p.path, "", "", "")).rsplit("/", 1)[0] + "/"
                        lines = []
                        for l in text.splitlines():
                            stripped = l.strip()
                            if stripped and not stripped.startswith("#"):
                                seg_url = urljoin(base, stripped)
                                lines.append(f"/api/video/proxy?url={seg_url}&referer={effective_referer}")
                            else:
                                lines.append(l)
                        yield "\n".join(lines).encode()
                    else:
                        async for chunk in r.content.iter_chunked(8192):
                            yield chunk
        except Exception:
            return

    ct = "application/vnd.apple.mpegurl" if ".m3u8" in url else "application/octet-stream"
    return StreamingResponse(_gen(), media_type=ct, headers={"Access-Control-Allow-Origin": "*"})


@router.get("/my-videos")
async def get_my_videos(page: int = 1, per_page: int = 10,
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    q = (select(Video).options(selectinload(Video.author_rel))
         .where(Video.user_id == user.id).order_by(Video.created_at.desc()))
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str | list] = None


@router.put("/my-videos/{video_id}/edit")
async def update_user_video(video_id: int, data: VideoUpdate,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(403, "Access denied")
    if data.title: video.title = data.title
    if data.description is not None: video.description = data.description
    if data.tags is not None:
        video.tags = ",".join(data.tags) if isinstance(data.tags, list) else data.tags
    await db.commit()
    await db.refresh(video)
    return {"message": "Video updated successfully", "video": video.to_dict()}


@router.delete("/my-videos/{video_id}/delete")
async def delete_user_video(video_id: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(403, "Access denied")
    await _delete_video(db, video)
    await db.commit()
    return {"message": "Video deleted successfully"}


@router.post("/history/{video_id}", status_code=200)
async def record_history(video_id: int, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    from app.models import WatchHistory
    from sqlalchemy import delete as sa_delete
    video = await db.get(Video, video_id)
    if not video or video.status != "approved":
        return {"ok": False}
    # 已有记录则更新时间，没有则新建
    existing = (await db.execute(
        select(WatchHistory).where(WatchHistory.user_id == user.id, WatchHistory.video_id == video_id)
    )).scalar_one_or_none()
    if existing:
        from datetime import datetime, timezone
        existing.watched_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        db.add(WatchHistory(user_id=user.id, video_id=video_id))
    await db.commit()
    return {"ok": True}


@router.get("/history")
async def get_history(page: int = 1, per_page: int = 20,
                      db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models import WatchHistory
    q = (select(WatchHistory)
         .options(selectinload(WatchHistory.video).selectinload(Video.author_rel))
         .where(WatchHistory.user_id == user.id)
         .order_by(WatchHistory.watched_at.desc()))
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {
        "history": [{"watched_at": h.watched_at.isoformat(), "video": h.video.to_dict()}
                    for h in items if h.video],
        "total": total, "pages": -(-total // per_page), "current_page": page
    }


@router.delete("/history")
async def clear_history(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models import WatchHistory
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(WatchHistory).where(WatchHistory.user_id == user.id))
    await db.commit()
    return {"message": "History cleared"}


@router.get("/download/{video_id}")
async def download_video(video_id: int, db: AsyncSession = Depends(get_db),
                         user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if video.status != "approved":
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / video.filename
    if not path.exists():
        raise HTTPException(404)
    safe_title = re.sub(r'[\\/:*?"<>|]', '', video.title).strip() or f'video_{video_id}'
    filename = f"{safe_title}.mp4"
    from urllib.parse import quote
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return FileResponse(path, media_type="video/mp4",
                        headers={"Content-Disposition": disposition})
