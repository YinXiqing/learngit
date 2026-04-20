import asyncio
import uvicorn

async def _init_db():
    from app.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(_init_db())
    uvicorn.run("run:app", host="0.0.0.0", port=5000, workers=4)

from app import create_app
app = create_app()
