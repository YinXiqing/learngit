from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from app.database import engine, Base

def create_app() -> FastAPI:
    app = FastAPI(title="Video Platform API")

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

    @app.on_event("startup")
    async def startup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    return app
