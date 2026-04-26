from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db, require_admin
from app.models import User
from config import settings
import time

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """健康检查端点 - 用于负载均衡器和监控"""
    try:
        # 检查数据库连接
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # 检查上传目录
    upload_dir_exists = settings.UPLOAD_FOLDER.exists()
    
    status = "healthy" if db_status == "healthy" and upload_dir_exists else "unhealthy"
    status_code = 200 if status == "healthy" else 503
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": status,
            "timestamp": time.time(),
            "checks": {
                "database": db_status,
                "upload_directory": "healthy" if upload_dir_exists else "unhealthy"
            }
        }
    )

@router.get("/metrics")
async def metrics(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """基础指标端点 - 用于监控"""
    from app.models import User, Video
    from sqlalchemy import func, select
    
    try:
        total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
        total_videos = (await db.execute(select(func.count(Video.id)))).scalar_one()
        approved_videos = (await db.execute(
            select(func.count(Video.id)).where(Video.status == "approved")
        )).scalar_one()
        pending_videos = (await db.execute(
            select(func.count(Video.id)).where(Video.status == "pending")
        )).scalar_one()
        
        return {
            "users": {
                "total": total_users
            },
            "videos": {
                "total": total_videos,
                "approved": approved_videos,
                "pending": pending_videos
            },
            "storage": {
                "upload_folder": str(settings.UPLOAD_FOLDER),
                "exists": settings.UPLOAD_FOLDER.exists()
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"error": str(e)}
        )
