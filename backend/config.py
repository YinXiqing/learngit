from pydantic_settings import BaseSettings
from pathlib import Path
import secrets

BASE_DIR = Path(__file__).parent

class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_SECRET_KEY: str = "jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    DATABASE_URL: str = f"postgresql+asyncpg://videoplatform:videoplatform@localhost/videoplatform"

    UPLOAD_FOLDER: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    ALLOWED_VIDEO_EXTENSIONS: set = {"mp4", "avi", "mkv", "mov", "wmv", "flv"}
    ALLOWED_IMAGE_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "webp"}

    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://192.168.1.101:3000",
    ]

    # llama.cpp server (OpenAI-compatible)
    LLAMA_BASE_URL: str = "http://localhost:8080"
    LLAMA_MODEL: str = "default"  # llama.cpp 不强制要求 model 字段，填任意值即可

    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "noreply@resend.dev"
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# 安全警告：生产环境必须使用强密钥
if settings.SECRET_KEY == "dev-secret-key-change-in-production":
    print("⚠️  WARNING: Using default SECRET_KEY! Generate a secure key with:")
    print(f"   SECRET_KEY={secrets.token_urlsafe(32)}")
if settings.JWT_SECRET_KEY == "jwt-secret-key-change-in-production":
    print("⚠️  WARNING: Using default JWT_SECRET_KEY! Generate a secure key with:")
    print(f"   JWT_SECRET_KEY={secrets.token_urlsafe(32)}")

settings.UPLOAD_FOLDER.mkdir(exist_ok=True)
