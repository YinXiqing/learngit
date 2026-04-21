import os, asyncio
import uvicorn
from app.logger import setup_logging

setup_logging()

async def _init_db():
    from app.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(_init_db())
    uvicorn.run("run:app", host="0.0.0.0", port=5000, workers=int(os.environ.get("WORKERS", 1)))

from app import create_app
app = create_app()
