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
    await db.execute(delete(Video).where(Video.user_id == user_id))
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
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True, "socket_timeout": 15}
    if proxy:
        ydl_opts["proxy"] = proxy
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    title = _re.sub(r"\s*\(\d+\)$", "", info.get("title", "") or "").strip() or "Untitled"
    cover_url = info.get("thumbnail", "")
    duration = int(info.get("duration") or 0)
    fmts = info.get("formats", [])
    m3u8 = [f for f in fmts if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("url")]
    direct = [f for f in fmts if f.get("url") and f.get("vcodec") != "none"]
    video_url = (max(m3u8, key=lambda f: f.get("height") or 0)["url"] if m3u8
                 else max(direct, key=lambda f: f.get("height") or 0)["url"] if direct
                 else info.get("url", ""))
    if video_url.endswith(".m3u") and not video_url.endswith(".m3u8"):
        video_url += "8"
    return title, cover_url, video_url, duration


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
    loop = asyncio.get_running_loop()
    try:
        title, cover_url, video_url, duration = await loop.run_in_executor(None, _ydlp_extract, url)
        tags_str = await _bs_tags(url)
    except Exception as e:
        raise HTTPException(500, f"抓取失败: {e}")

    scraped = ScrapedVideoInfo(source_url=url, title=title, description="",
                               video_url=video_url, cover_url=cover_url, duration=duration, tags=tags_str)
    db.add(scraped)
    await db.commit()
    await db.refresh(scraped)
    return {"message": "视频信息抓取成功",
            "scraped_info": {"source_url": url, "title": title, "description": "",
                             "video_url": video_url, "cover_url": cover_url, "tags": tags_str},
            "scraped_id": scraped.id}


class BatchScrapeIn(BaseModel):
    urls: list[str]


@router.post("/scrape/batch")
async def scrape_videos_batch(data: BatchScrapeIn, db: AsyncSession = Depends(get_db),
                              admin: User = Depends(require_admin)):
    urls = [u.strip() for u in data.urls if u.strip()][:20]
    if not urls:
        raise HTTPException(400, "No valid URLs provided")
    loop = asyncio.get_running_loop()
    success, failed = 0, 0
    for url in urls:
        try:
            title, cover_url, video_url, duration = await loop.run_in_executor(None, _ydlp_extract, url)
            tags_str = await _bs_tags(url)
            scraped = ScrapedVideoInfo(source_url=url, title=title, description="",
                                       video_url=video_url, cover_url=cover_url,
                                       duration=duration, tags=tags_str)
            db.add(scraped)
            success += 1
        except Exception:
            failed += 1
    await db.commit()
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
                                "status": v.status} for v in items],
            "total": total, "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class ImportIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

@router.post("/scraped/{scraped_id}/import", status_code=201)
async def import_scraped_video(scraped_id: int, data: ImportIn = ImportIn(),
                               db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped:
        raise HTTPException(404)
    video = Video(title=data.title or scraped.title or "Untitled",
                  description=data.description if data.description is not None else (scraped.description or ""),
                  tags=scraped.tags or "", source_url=scraped.video_url, page_url=scraped.source_url,
                  cover_image=scraped.cover_url, duration=scraped.duration or 0,
                  is_scraped=True, user_id=admin.id, status="approved",
                  filename="external_video", file_size=0)
    db.add(video)
    scraped.status = "published"
    await db.commit()
    await db.refresh(video)

    # background: download cover locally
    if scraped.cover_url and scraped.cover_url.startswith("http"):
        asyncio.create_task(_download_cover(video.id, scraped.cover_url))

    return {"message": "Video published successfully", "video": video.to_dict()}


async def _download_cover(video_id: int, cover_url: str):
    try:
        import aiofiles
        from app.database import AsyncSessionLocal
        ext = cover_url.split("?")[0].rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp", "gif"): ext = "jpg"
        fname = f"cover_{uuid.uuid4().hex}.{ext}"
        async with aiohttp.ClientSession() as s:
            async with s.get(cover_url, headers={"User-Agent": "Mozilla/5.0"}, ssl=False) as r:
                r.raise_for_status()
                content = await r.read()
        async with aiofiles.open(settings.UPLOAD_FOLDER / fname, "wb") as f:
            await f.write(content)
        async with AsyncSessionLocal() as db:
            await db.execute(update(Video).where(Video.id == video_id).values(cover_image=fname))
            await db.commit()
    except Exception as e:
        logger.warning("cover_download_failed", video_id=video_id, error=str(e))


class ScrapedUpdate(BaseModel):
    title: Optional[str] = None

@router.put("/scraped/{scraped_id}")
async def update_scraped(scraped_id: int, data: ScrapedUpdate,
                         db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped:
        raise HTTPException(404)
    if data.title is not None: scraped.title = data.title.strip()
    await db.commit()
    return {"message": "Updated", "title": scraped.title}


@router.delete("/scraped/{scraped_id}")
async def delete_scraped(scraped_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    scraped = await db.get(ScrapedVideoInfo, scraped_id)
    if not scraped:
        raise HTTPException(404)
    await db.delete(scraped)
    await db.commit()
    return {"message": "Deleted"}


class BatchIds(BaseModel):
    video_ids: list[int]


@router.post("/scraped/batch-publish")
async def batch_publish(data: BatchIds, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    items = (await db.execute(select(ScrapedVideoInfo).where(
        ScrapedVideoInfo.id.in_(data.video_ids), ScrapedVideoInfo.status == "pending"))).scalars().all()
    videos = []
    for s in items:
        v = Video(title=s.title or "Untitled", description=s.description or "", tags=s.tags or "",
                  source_url=s.video_url, page_url=s.source_url, cover_image=s.cover_url,
                  duration=s.duration or 0, is_scraped=True, user_id=admin.id,
                  status="approved", filename="external_video", file_size=0)
        db.add(v)
        s.status = "published"
        videos.append(v)
    await db.commit()
    for v in videos:
        await db.refresh(v)
        if v.cover_image and v.cover_image.startswith("http"):
            asyncio.create_task(_download_cover(v.id, v.cover_image))
    return {"message": f"成功发布 {len(videos)} 个视频", "success_count": len(videos)}


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
