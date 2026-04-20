import re, asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.deps import get_db, get_current_user
from app.models import User
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

class RegisterIn(BaseModel):
    username: str
    email: str
    password: str

class LoginIn(BaseModel):
    username: str
    password: str

class ProfileUpdate(BaseModel):
    email: str | None = None
    password: str | None = None

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, data: RegisterIn, db: AsyncSession = Depends(get_db)):
    username = data.username.strip()
    email = data.email.strip().lower()
    if len(username) < 3 or len(username) > 80:
        raise HTTPException(400, "Username must be 3-80 characters")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email format")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.execute(select(User).where(or_(User.username == username, User.email == email)))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Username or email already exists")

    user = User(username=username, email=email)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, user.set_password, data.password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"message": "User registered successfully", "user": user.to_dict()}

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, response: Response, data: LoginIn, db: AsyncSession = Depends(get_db)):
    ident = data.username.strip()
    result = await db.execute(select(User).where(or_(User.username == ident, User.email == ident)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "用户名或邮箱不存在")
    loop = asyncio.get_running_loop()
    if not await loop.run_in_executor(None, user.check_password, data.password):
        raise HTTPException(401, "密码错误")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")
    
    token = create_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,  # 生产环境改为 True (需要 HTTPS)
        samesite="lax",
        max_age=settings.JWT_EXPIRE_HOURS * 3600
    )
    return {"message": "Login successful", "access_token": token, "user": user.to_dict()}

@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    return {"user": user.to_dict()}

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}

@router.put("/profile")
async def update_profile(data: ProfileUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if data.email:
        email = data.email.strip().lower()
        if not EMAIL_RE.match(email):
            raise HTTPException(400, "Invalid email format")
        existing = await db.execute(select(User).where(User.email == email, User.id != user.id))
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Email already exists")
        user.email = email
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, user.set_password, data.password)
    await db.commit()
    await db.refresh(user)
    return {"message": "Profile updated successfully", "user": user.to_dict()}
