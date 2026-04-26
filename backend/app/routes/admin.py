import os, uuid, asyncio
from app.logger import logger
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select, or_, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import aiohttp
from bs4 import BeautifulSoup
import re
from app.deps import get_db, get_current_user, require_admin
from app.models import User, Video, ScrapedVideoInfo
from config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(page: int = 1, per_page: int = 20, search: str = "",
                    db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    q = select(User)
    if search:
        pat = f"%{search}%"
        q = q.where(or_(User.username.ilike(pat), User.email.ilike(pat)))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"users": [u.to_dict() for u in items], "total": total,
            "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate,
                      db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    if data.role and data.role in ("user", "admin"):
        if user_id == admin.id:
            raise HTTPException(400, "Cannot change your own role")
        user.role = data.role
    if data.is_active is not None:
        if user_id == admin.id and not data.is_active:
            raise HTTPException(400, "Cannot disable your own account")
        user.is_active = data.is_active
    await db.commit()
    await db.refresh(user)
    return {"message": "User updated successfully", "user": user.to_dict()}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(400, "Cannot delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    from app.routes.video import _delete_video
    videos = (await db.execute(select(Video).where(Video.user_id == user_id))).scalars().all()
    for v in videos:
        await _delete_video(db, v)
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}


# ── Videos ────────────────────────────────────────────────────────────────────

@router.get("/videos")
async def get_all_videos(page: int = 1, per_page: int = 20, status: str = "all", search: str = "",
                         db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    q = select(Video).options(selectinload(Video.author_rel))
    if status != "all" and status in ("pending", "approved", "rejected"):
        q = q.where(Video.status == status)
    if search:
        pat = f"%{search}%"
        q = q.join(User).where(or_(Video.title.ilike(pat), Video.description.ilike(pat), User.username.ilike(pat)))
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.order_by(Video.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class VideoAdminUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str | list] = None
    status: Optional[str] = None


@router.put("/videos/{video_id}")
async def update_video(video_id: int, data: VideoAdminUpdate,
                       db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if data.title: video.title = data.title.strip()
    if data.description is not None: video.description = data.description.strip()
    if data.tags is not None:
        video.tags = ",".join(data.tags) if isinstance(data.tags, list) else data.tags.strip()
    if data.status and data.status in ("pending", "approved", "rejected"):
        video.status = data.status
    await db.commit()
    await db.refresh(video)
    return {"message": "Video updated successfully", "video": video.to_dict()}


@router.delete("/videos/{video_id}")
async def delete_video(video_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    from app.routes.video import _delete_video
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    await _delete_video(db, video)
    await db.commit()
    return {"message": "Video deleted successfully"}


class BulkIds(BaseModel):
    video_ids: list[int]
    status: Optional[str] = None


@router.post("/videos/bulk-update")
async def bulk_update_videos(data: BulkIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    if not data.status or data.status not in ("pending", "approved", "rejected"):
        raise HTTPException(400, "Invalid status")
    result = await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(status=data.status))
    await db.commit()
    return {"message": f"{result.rowcount} videos updated", "updated_count": result.rowcount}


@router.post("/videos/bulk-delete")
async def bulk_delete_videos(data: BulkIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    from app.routes.video import _delete_video
    videos = (await db.execute(select(Video).where(Video.id.in_(data.video_ids)))).scalars().all()
    for v in videos:
        await _delete_video(db, v)
    await db.commit()
    return {"message": f"{len(videos)} videos deleted", "deleted_count": len(videos)}


# ── Scraping ──────────────────────────────────────────────────────────────────

def _ydlp_extract(url):
    import yt_dlp, re as _re
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or ""
    cookies_file = os.environ.get("YTDLP_COOKIES_FILE") or ""
    ydl_opts = {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "noplaylist": True, "socket_timeout": 20,
        # 优先选最高画质 mp4/m3u8，回退到任意最佳
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
        "extractor_args": {"youtube": {"skip": ["dash"]}},
    }
    if proxy:
        ydl_opts["proxy"] = proxy
    if cookies_file and os.path.exists(cookies_file):
        ydl_opts["cookiefile"] = cookies_file
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    title = _re.sub(r"\s*\(\d+\)$", "", info.get("title", "") or "").strip() or "Untitled"
    cover_url = info.get("thumbnail", "")
    duration = int(info.get("duration") or 0)
    fmts = info.get("formats", [])
    # 优先 m3u8（流媒体），其次最高画质直链
    m3u8 = [f for f in fmts if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("url") and f.get("vcodec") != "none"]
    direct = [f for f in fmts if f.get("url") and f.get("vcodec") not in (None, "none")]
    video_url = (
        max(m3u8, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0))["url"] if m3u8
        else max(direct, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0))["url"] if direct
        else info.get("url", "")
    )
    # 取对应 format 的 http_headers
    best_fmt = (
        max(m3u8, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if m3u8
        else max(direct, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if direct
        else {}
    )
    http_headers = best_fmt.get("http_headers", {}) if best_fmt else {}
    # 确保 Referer 是原始页面 URL
    if url not in http_headers.get("Referer", ""):
        http_headers["Referer"] = url
    if video_url.endswith(".m3u") and not video_url.endswith(".m3u8"):
        video_url += "8"
    return title, cover_url, video_url, duration, http_headers, bool(m3u8)


async def _bs_tags(url):
    try:
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or None
        async with aiohttp.ClientSession() as s:
            async with s.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=aiohttp.ClientTimeout(total=10), proxy=proxy, ssl=False) as r:
                content = await r.read()
        soup = BeautifulSoup(content, "html.parser")
        tags = [t.get("content", "").strip() for t in soup.find_all("meta", property="video:tag") if t.get("content")]
        if not tags:
            kw = soup.find("meta", attrs={"name": "keywords"})
            tags = [t.strip() for t in (kw.get("content", "") if kw else "").split(",") if t.strip()]
        return ",".join(tags[:15])
    except Exception:
        return ""


class ScrapeIn(BaseModel):
    url: str


@router.post("/scrape")
async def scrape_video(data: ScrapeIn, db: AsyncSession = Depends(get_db),
                       admin: User = Depends(require_admin)):
    url = data.url.strip()
    existing = (await db.execute(select(ScrapedVideoInfo).where(ScrapedVideoInfo.source_url == url))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "该 URL 已抓取过")
    loop = asyncio.get_running_loop()
    try:
        title, cover_url, video_url, duration, http_headers, is_m3u8 = await loop.run_in_executor(None, _ydlp_extract, url)
    except Exception as e:
        raise HTTPException(500, f"抓取失败: {e}")

    import json
    scraped = ScrapedVideoInfo(source_url=url, title=title, description="",
                               video_url=video_url, cover_url=cover_url, duration=duration,
                               tags="", http_headers=json.dumps(http_headers) if http_headers else None,
                               is_m3u8=is_m3u8)
    db.add(scraped)
    await db.commit()
    await db.refresh(scraped)
    return {"message": "视频信息抓取成功",
            "scraped_info": {"source_url": url, "title": title, "description": "",
                             "video_url": video_url, "cover_url": cover_url, "tags": ""},
            "scraped_id": scraped.id}


class BatchScrapeIn(BaseModel):
    urls: list[str]


@router.post("/scrape/batch")
async def scrape_videos_batch(data: BatchScrapeIn, db: AsyncSession = Depends(get_db),
                              admin: User = Depends(require_admin)):
    urls = [u.strip() for u in data.urls if u.strip()][:20]
    if not urls:
        raise HTTPException(400, "No valid URLs provided")
    # 过滤已抓取的 URL
    existing_urls = set((await db.execute(
        select(ScrapedVideoInfo.source_url).where(ScrapedVideoInfo.source_url.in_(urls))
    )).scalars().all())
    urls = [u for u in urls if u not in existing_urls]
    if not urls:
        raise HTTPException(409, "所有 URL 均已抓取过")
    loop = asyncio.get_running_loop()
    import json
    sem = asyncio.Semaphore(3)

    async def scrape_one(url: str):
        async with sem:
            try:
                title, cover_url, video_url, duration, http_headers, is_m3u8 = await loop.run_in_executor(None, _ydlp_extract, url)
                return ScrapedVideoInfo(source_url=url, title=title, description="",
                                        video_url=video_url, cover_url=cover_url, duration=duration, tags="",
                                        http_headers=json.dumps(http_headers) if http_headers else None,
                                        is_m3u8=is_m3u8)
            except Exception:
                return None

    results = await asyncio.gather(*[scrape_one(u) for u in urls])
    success = 0
    for item in results:
        if item:
            db.add(item); success += 1
    await db.commit()
    failed = len(urls) - success
    return {"message": f"批量抓取完成：成功 {success} 个，失败 {failed} 个",
            "success": success, "failed": failed}


@router.get("/scraped")
async def get_scraped_videos(page: int = 1, per_page: int = 20, status: str = "pending",
                             db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    q = select(ScrapedVideoInfo)
    if status != "all":
        q = q.where(ScrapedVideoInfo.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(ScrapedVideoInfo.scraped_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"scraped_videos": [{"id": v.id, "source_url": v.source_url, "title": v.title,
                                "description": v.description, "cover_url": v.cover_url,
                                "video_url": v.video_url, "tags": v.tags,
                                "scraped_at": v.scraped_at.isoformat() if v.scraped_at else None,
                                "status": v.status,
                                "download_status": v.download_status,
                                "download_progress": v.download_progress,
                                "local_filename": v.local_filename,
                                "is_m3u8": v.is_m3u8,
                                "video_id": v.video_id} for v in items],
            "total": total, "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class ImportIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


# ── 下载任务 ──────────────────────────────────────────────────────────────────

async def _run_download(scraped_id: int, source_url: str, cover_url: Optional[str]):
    """后台任务：yt-dlp 下载合并视频 + ffmpeg 切 HLS，30分钟超时"""
    try:
        await asyncio.wait_for(_do_download(scraped_id, source_url, cover_url), timeout=7200)
    except asyncio.TimeoutError:
        logger.warning("scraper_download_timeout", scraped_id=scraped_id)
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await db.execute(update(ScrapedVideoInfo).where(ScrapedVideoInfo.id == scraped_id)
                             .values(download_status="failed", download_progress=0))
            await db.commit()


async def _do_download(scraped_id: int, source_url: str, cover_url: Optional[str]):
    from app.database import AsyncSessionLocal
    import json, shutil

    mp4_name = f"scraped_{scraped_id}.mp4"
    mp4_path = settings.UPLOAD_FOLDER / mp4_name
    hls_dir = settings.UPLOAD_FOLDER / "hls" / str(scraped_id)  # 临时目录，发布时迁移

    async def set_state(progress: int, status: str = "downloading"):
        async with AsyncSessionLocal() as db:
            await db.execute(update(ScrapedVideoInfo).where(ScrapedVideoInfo.id == scraped_id)
                             .values(download_progress=progress, download_status=status))
            await db.commit()

    try:
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or ""
        cookies_file = os.environ.get("YTDLP_COOKIES_FILE") or ""
        loop = asyncio.get_running_loop()

        # Step 1: yt-dlp 下载并合并
        progress_state = {"val": 0}

        def progress_hook(d):
            if d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                done = d.get("downloaded_bytes") or 0
                if total > 0:
                    pct = min(int(done / total * 75), 75)
                    if pct > progress_state["val"]:
                        progress_state["val"] = pct
                        asyncio.run_coroutine_threadsafe(set_state(pct), loop)

        ydl_opts = {
            "quiet": True, "no_warnings": True, "noplaylist": True,
            "outtmpl": str(mp4_path),
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
            "socket_timeout": 30,
            "progress_hooks": [progress_hook],
        }
        if proxy: ydl_opts["proxy"] = proxy
        if cookies_file and os.path.exists(cookies_file): ydl_opts["cookiefile"] = cookies_file

        def _download():
            import yt_dlp
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([source_url])

        await loop.run_in_executor(None, _download)
        await set_state(80)

        # Step 2: ffmpeg 切 HLS
        hls_dir.mkdir(parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", str(mp4_path),
            "-c", "copy", "-hls_time", "6", "-hls_playlist_type", "vod",
            "-hls_segment_filename", str(hls_dir / "seg%03d.ts"),
            str(hls_dir / "index.m3u8"),
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        if proc.returncode != 0:
            raise RuntimeError("ffmpeg 切片失败")
        await set_state(95)

        # Step 3: 下载封面
        cover_fname = None
        if cover_url and cover_url.startswith("http"):
            try:
                import aiofiles
                ext = cover_url.split("?")[0].rsplit(".", 1)[-1].lower()
                if ext not in ("jpg", "jpeg", "png", "webp"): ext = "jpg"
                cover_fname = f"cover_scraped_{scraped_id}.{ext}"
                async with aiohttp.ClientSession() as s:
                    async with s.get(cover_url, headers={"User-Agent": "Mozilla/5.0", "Referer": source_url}, ssl=False) as r:
                        content = await r.read()
                async with aiofiles.open(settings.UPLOAD_FOLDER / cover_fname, "wb") as f:
                    await f.write(content)
            except Exception:
                cover_fname = None

        async with AsyncSessionLocal() as db:
            await db.execute(update(ScrapedVideoInfo).where(ScrapedVideoInfo.id == scraped_id).values(
                download_status="done", download_progress=100,
                local_filename=mp4_name,
                **({"cover_url": cover_fname} if cover_fname else {}),
            ))
            await db.commit()

    except Exception as e:
        logger.warning("scraper_download_failed", scraped_id=scraped_id, error=str(e))
        shutil.rmtree(hls_dir, ignore_errors=True)
        if mp4_path.exists(): mp4_path.unlink(missing_ok=True)
        await set_state(0, "failed")


@router.post("/scraped/{scraped_id}/download")
async def start_download(scraped_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped: raise HTTPException(404)
    if scraped.download_status == "downloading": raise HTTPException(400, "已在下载中")
    if not scraped.source_url: raise HTTPException(400, "无视频地址")
    scraped.download_status = "downloading"
    scraped.download_progress = 0
    await db.commit()
    asyncio.create_task(_run_download(scraped_id, scraped.source_url, scraped.cover_url))
    return {"message": "下载任务已启动"}


@router.get("/scraped/{scraped_id}/progress")
async def get_progress(scraped_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped: raise HTTPException(404)
    return {"download_status": scraped.download_status, "download_progress": scraped.download_progress,
            "local_filename": scraped.local_filename}


@router.post("/scraped/{scraped_id}/import", status_code=201)
async def import_scraped_video(scraped_id: int, data: ImportIn = ImportIn(),
                               db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped: raise HTTPException(404)
    if scraped.download_status != "done": raise HTTPException(400, "请先下载视频")

    mp4_path = settings.UPLOAD_FOLDER / scraped.local_filename
    duration = 0
    if mp4_path.exists():
        try:
            import subprocess as _sp, json as _json
            r = _sp.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(mp4_path)],
                        capture_output=True, text=True, timeout=10)
            duration = int(float(_json.loads(r.stdout)["format"]["duration"]))
        except Exception:
            pass

    video = Video(
        title=data.title or scraped.title or "Untitled",
        description=data.description if data.description is not None else (scraped.description or ""),
        tags=scraped.tags or "", page_url=scraped.source_url,
        cover_image=scraped.cover_url, duration=duration,
        is_scraped=False, hls_ready=False,
        user_id=admin.id, status="approved",
        filename=scraped.local_filename,
        file_size=mp4_path.stat().st_size if mp4_path.exists() else 0,
        source_url=None,
    )
    db.add(video)
    scraped.status = "published"
    await db.commit()
    await db.refresh(video)
    scraped.video_id = video.id
    await db.commit()

    # 迁移 HLS 目录到 hls/{video.id}/
    import shutil
    src_hls = settings.UPLOAD_FOLDER / "hls" / str(scraped_id)
    dst_hls = settings.UPLOAD_FOLDER / "hls" / str(video.id)
    if src_hls.exists() and not dst_hls.exists():
        shutil.move(str(src_hls), str(dst_hls))
        await db.execute(update(Video).where(Video.id == video.id).values(hls_ready=True))
        await db.commit()
        await db.refresh(video)

    return {"message": "Video published successfully", "video": video.to_dict()}




class ScrapedUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

@router.put("/scraped/{scraped_id}")
async def update_scraped(scraped_id: int, data: ScrapedUpdate,
                         db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped:
        raise HTTPException(404)
    if data.title is not None: scraped.title = data.title.strip()
    if data.description is not None: scraped.description = data.description
    await db.commit()
    return {"message": "Updated", "title": scraped.title, "description": scraped.description}


@router.delete("/scraped/{scraped_id}")
async def delete_scraped(scraped_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped:
        raise HTTPException(404)
    # 清理本地文件
    import shutil
    if scraped.local_filename:
        p = settings.UPLOAD_FOLDER / scraped.local_filename
        if p.exists(): p.unlink(missing_ok=True)
    hls_dir = settings.UPLOAD_FOLDER / "hls" / str(scraped_id)
    if hls_dir.exists(): shutil.rmtree(hls_dir, ignore_errors=True)
    cover = scraped.cover_url
    if cover and not cover.startswith("http"):
        p = settings.UPLOAD_FOLDER / cover
        if p.exists(): p.unlink(missing_ok=True)
    await db.delete(scraped)
    await db.commit()
    return {"message": "Deleted"}


class BatchIds(BaseModel):
    video_ids: list[int]


@router.post("/scraped/batch-download")
async def batch_download_scraped(data: BatchIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    items = (await db.execute(select(ScrapedVideoInfo).where(
        ScrapedVideoInfo.id.in_(data.video_ids),
        ScrapedVideoInfo.download_status.in_(["none", "failed"])))).scalars().all()
    started = 0
    for s in items:
        s.download_status = "downloading"; s.download_progress = 0
        asyncio.create_task(_run_download(s.id, s.source_url, s.cover_url))
        started += 1
    await db.commit()
    return {"message": f"已启动 {started} 个下载任务", "started": started}


@router.post("/scraped/batch-publish")
async def batch_publish(data: BatchIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """批量发布 = 批量触发下载，下载完成后手动发布"""
    items = (await db.execute(select(ScrapedVideoInfo).where(
        ScrapedVideoInfo.id.in_(data.video_ids),
        ScrapedVideoInfo.download_status.in_(["none", "failed"])))).scalars().all()
    started = 0
    for s in items:
        s.download_status = "downloading"; s.download_progress = 0
        asyncio.create_task(_run_download(s.id, s.source_url, s.cover_url))
        started += 1
    await db.commit()
    return {"message": f"已启动 {started} 个下载任务", "started": started}

@router.post("/scraped/batch-delete")
async def batch_delete_scraped(data: BatchIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(delete(ScrapedVideoInfo).where(ScrapedVideoInfo.id.in_(data.video_ids)))
    await db.commit()
    return {"message": f"成功删除 {result.rowcount} 条记录", "success_count": result.rowcount}


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_videos = (await db.execute(select(func.count(Video.id)))).scalar_one()
    pending = (await db.execute(select(func.count(Video.id)).where(Video.status == "pending"))).scalar_one()
    approved = (await db.execute(select(func.count(Video.id)).where(Video.status == "approved"))).scalar_one()
    total_views = (await db.execute(select(func.sum(Video.view_count)))).scalar_one() or 0
    return {"total_users": total_users, "total_videos": total_videos,
            "pending_videos": pending, "approved_videos": approved, "total_views": int(total_views)}


# ── M3U8 代理（解决浏览器 CORS 限制）────────────────────────────────────────

@router.get("/proxy")
async def proxy_m3u8(url: str):
    """代理转发 m3u8 及 ts 分片，解决浏览器 CORS 问题"""
    import urllib.parse
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or None
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"User-Agent": "Mozilla/5.0", "Referer": url},
                                   proxy=proxy, ssl=False, timeout=aiohttp.ClientTimeout(total=15)) as r:
                content_type = r.headers.get("Content-Type", "application/octet-stream")
                body = await r.read()

        # 如果是 m3u8 文本，重写其中的 ts/分片 URL 为代理 URL
        if "mpegurl" in content_type or url.endswith(".m3u8"):
            text = body.decode("utf-8", errors="replace")
            base = url.rsplit("/", 1)[0] + "/"
            lines = []
            for line in text.splitlines():
                if line and not line.startswith("#"):
                    abs_url = line if line.startswith("http") else base + line
                    line = f"/api/admin/proxy?url={urllib.parse.quote(abs_url, safe='')}"
                lines.append(line)
            body = "\n".join(lines).encode()
            content_type = "application/vnd.apple.mpegurl"

        return Response(content=body, media_type=content_type,
                        headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"})
    except Exception as e:
        raise HTTPException(502, f"代理请求失败: {e}")
