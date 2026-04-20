from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from config import settings
from app.database import engine, Base

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

def create_app() -> FastAPI:
    app = FastAPI(title="Video Platform API")
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routes.auth import router as auth_router
    from app.routes.video import router as video_router
    from app.routes.admin import router as admin_router
    app.include_router(auth_router)
    app.include_router(video_router)
    app.include_router(admin_router)

    return app
