import re, asyncio, secrets
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


class ForgotPasswordIn(BaseModel):
    email: str

class ResetPasswordIn(BaseModel):
    token: str
    password: str

@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ForgotPasswordIn, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timedelta
    from app.models import PasswordResetToken
    from sqlalchemy import delete as sa_delete

    email = data.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    # 无论用户是否存在都返回相同响应，防止枚举攻击
    if not user:
        return {"message": "如果该邮箱已注册，重置链接已发送"}

    # 删除旧 token
    await db.execute(sa_delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    await db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    if settings.RESEND_API_KEY:
        try:
            import resend
            resend.api_key = settings.RESEND_API_KEY
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: resend.Emails.send({
                "from": settings.RESEND_FROM,
                "to": user.email,
                "subject": "重置密码 - 视频平台",
                "html": f"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="color:#e11d48">重置密码</h2>
                  <p>你好 {user.username}，</p>
                  <p>点击下方按钮重置密码，链接 30 分钟内有效：</p>
                  <a href="{reset_url}" style="display:inline-block;background:#e11d48;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0">重置密码</a>
                  <p style="color:#888;font-size:12px">如果你没有请求重置密码，请忽略此邮件。</p>
                </div>
                """
            }))
        except Exception as e:
            logger.warning("reset_email_failed", email=email, error=str(e))

    return {"message": "如果该邮箱已注册，重置链接已发送"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordIn, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    from app.models import PasswordResetToken

    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    record = (await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == data.token, PasswordResetToken.used == False)
    )).scalar_one_or_none()

    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(400, "链接无效或已过期")

    user = await db.get(User, record.user_id)
    if not user:
        raise HTTPException(400, "用户不存在")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, user.set_password, data.password)
    record.used = True
    await db.commit()
    return {"message": "密码重置成功"}


@router.get("/reset-password/verify")
async def verify_reset_token(token: str, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    from app.models import PasswordResetToken
    record = (await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == token, PasswordResetToken.used == False)
    )).scalar_one_or_none()
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(400, "链接无效或已过期")
    return {"valid": True}
