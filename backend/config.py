from pydantic_settings import BaseSettings
from pathlib import Path

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

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
settings.UPLOAD_FOLDER.mkdir(exist_ok=True)
