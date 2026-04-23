import json
import re
import aiohttp
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db, get_current_user
from app.models import Video, User
from config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])

LLAMA_URL = getattr(settings, "LLAMA_BASE_URL", "http://localhost:8080")
LLAMA_MODEL = getattr(settings, "LLAMA_MODEL", "default")

# ── DB 工具 ──────────────────────────────────────────────────────────────────

async def _search_videos(keyword: str, db: AsyncSession) -> list[dict]:
    pat = f"%{keyword}%"
    rows = (await db.execute(
        select(Video).where(
            Video.status == "approved",
            or_(Video.title.ilike(pat), Video.description.ilike(pat), Video.tags.ilike(pat))
        ).limit(8)
    )).scalars().all()
    return [{"id": v.id, "title": v.title, "cover": v.cover_image, "is_scraped": v.is_scraped} for v in rows]

async def _get_my_videos(user_id: int, db: AsyncSession) -> dict:
    from sqlalchemy import case
    rows = (await db.execute(
        select(Video).where(Video.user_id == user_id).order_by(Video.created_at.desc()).limit(20)
    )).scalars().all()
    approved = [v for v in rows if v.status == "approved"]
    pending  = [v for v in rows if v.status == "pending"]
    rejected = [v for v in rows if v.status == "rejected"]
    return {
        "total": len(rows), "approved": len(approved), "pending": len(pending), "rejected": len(rejected),
        "videos": [{"id": v.id, "title": v.title, "status": v.status, "view_count": v.view_count,
                    "cover": v.cover_image, "is_scraped": v.is_scraped} for v in rows[:10]]
    }

async def _get_my_history(user_id: int, db: AsyncSession) -> list[dict]:
    from app.models import WatchHistory
    rows = (await db.execute(
        select(WatchHistory).where(WatchHistory.user_id == user_id)
        .order_by(WatchHistory.watched_at.desc()).limit(10)
    )).scalars().all()
    result = []
    for h in rows:
        v = await db.get(Video, h.video_id)
        if v:
            result.append({"id": v.id, "title": v.title, "cover": v.cover_image,
                           "is_scraped": v.is_scraped, "watched_at": h.watched_at.isoformat()})
    return result

# ── 本地意图识别（无需调用模型，毫秒级响应） ──────────────────────────────────

_NAV_PATTERNS = [
    (r'(首页|主页|回到首页)', '/'),
    (r'(登录|登陆)', '/login'),
    (r'注册', '/register'),
    (r'(上传|上传视频|上传页)', '/upload'),
    (r'(我的视频|我上传的)', '/my-videos'),
    (r'(观看历史|历史记录|看过的)', '/history'),
    (r'(个人资料|个人中心|我的资料|个人信息)', '/profile'),
    (r'(搜索页|搜索页面)', '/search'),
]

def _detect_action(text: str) -> dict | None:
    """本地规则快速识别操作意图，返回 action dict 或 None"""
    t = text.strip()

    # 退出登录
    if re.search(r'(退出|登出|注销)', t):
        return {"type": "logout"}

    # 播放视频（播放视频123 / 看视频5 / 打开视频2）
    m = re.search(r'(播放|看|打开).{0,4}视频\s*(\d+)', t)
    if not m:
        m = re.search(r'视频\s*(\d+)', t) if re.search(r'(播放|看|打开)', t) else None
    if m:
        vid = int(m.group(m.lastindex))
        return {"type": "play", "video_id": vid}

    # 搜索视频
    m = re.search(r'(搜索|找|查找|查一下)\s*(.+?)(?:视频|$)', t)
    if m:
        kw = m.group(2).strip()
        if kw:
            return {"type": "search", "keyword": kw}

    # 查询我的视频
    if re.search(r'(我的视频|我上传的|我发布的|我有几个|我传了)', t) and re.search(r'(视频|几个|多少)', t):
        return {"type": "my_videos"}

    # 查询我的历史
    if re.search(r'(我(看过|观看过|的历史|最近看)|历史记录|看过什么)', t):
        return {"type": "my_history"}

    # 导航
    for pattern, url in _NAV_PATTERNS:
        if re.search(pattern, t):
            return {"type": "navigate", "url": url}

    return None

async def _platform_stats(db: AsyncSession) -> dict:
    from app.models import WatchHistory
    approved = (await db.execute(select(func.count(Video.id)).where(Video.status == "approved"))).scalar_one()
    pending  = (await db.execute(select(func.count(Video.id)).where(Video.status == "pending"))).scalar_one()
    users    = (await db.execute(select(func.count(User.id)))).scalar_one()
    views    = (await db.execute(select(func.sum(Video.view_count)))).scalar_one() or 0
    top5     = (await db.execute(
        select(Video).where(Video.status == "approved").order_by(Video.view_count.desc()).limit(5)
    )).scalars().all()
    newest5  = (await db.execute(
        select(Video).where(Video.status == "approved").order_by(Video.created_at.desc()).limit(5)
    )).scalars().all()
    return {
        "approved": approved, "pending": pending, "users": users, "views": views,
        "top5": [{"id": v.id, "title": v.title, "views": v.view_count} for v in top5],
        "newest5": [{"id": v.id, "title": v.title, "author": v.author_rel.username if v.author_rel else "未知"} for v in newest5],
    }

# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """你是视频平台的 AI 助手，对平台所有功能了如指掌，能回答问题、指导操作、分析数据。

## 平台页面与功能详解

### 首页 /
- 展示已审核通过的视频列表，无限滚动（每次加载12条）
- 顶部标签栏：点击标签按分类筛选视频
- 排序：最新（按上传时间）/ 最热（按播放量）
- 视频卡片：封面图、标题、作者名、播放量、时长、上传时间，点击进入详情页
- 未登录用户可正常浏览

### 搜索页 /search
- 搜索框支持按标题、作者名、简介、标签模糊搜索
- 搜索历史：本地缓存最近10条，点击复用，可逐条删除
- 结果列表支持无限滚动，显示匹配总数
- 支持标签筛选和排序（最新/最热）
- 未登录用户可正常搜索

### 视频详情页 /video/[id]
- 视频播放器（HLS 流媒体，hls.js）
- 播放进度自动记忆（localStorage），下次从上次位置继续
- 播放失败自动重试刷新播放地址
- 显示：标题、作者、播放量、上传时间、简介、标签
- 播放量去重：同一用户1小时内只计1次
- 登录用户观看记录自动写入观看历史
- 未登录用户可观看已审核视频

### 登录页 /login
- 输入用户名 + 密码登录
- 登录成功：JWT Token 存入 localStorage 和 Cookie，有效期24小时
- 页面有"忘记密码"和"去注册"链接

### 注册页 /register
- 填写用户名（3-20字符）、邮箱、密码（至少6位）
- 注册成功后跳转登录页

### 忘记密码页 /forgot-password
- 输入注册邮箱，点击"发送重置链接"
- 系统发送含重置链接的邮件，链接30分钟内有效

### 重置密码页 /reset-password?token=xxx
- 通过邮件中的链接访问，输入新密码 + 确认密码，提交后跳转登录页

### 上传页 /upload（需登录）
操作流程：
1. 拖拽或点击选择视频文件（MP4/AVI/MKV/MOV/WMV/FLV，最大500MB）
2. 可选上传封面图（JPG/PNG/GIF/WebP，最大10MB）；不上传则自动截取视频第1秒
3. 填写标题（必填）、标签（逗号分隔，可选）、简介（可选）
4. 点击"上传视频"，显示上传进度条
5. 上传完成跳转"我的视频"页
- 上传后状态为"待审核"，需管理员审核通过才公开
- 后台自动转码为 HLS 分片，转码完成前无法播放

### 我的视频 /my-videos（需登录）
- 展示当前用户上传的所有视频
- 顶部标签筛选：全部 / 已通过 / 待审核 / 已拒绝，每个标签显示数量
- 每条视频：封面（可点击预览）、标题、简介、状态徽章、播放量、上传日期
- 操作：预览（弹出播放器）、编辑（修改标题/简介/标签，弹窗保存）、删除（有确认弹窗）
- 右上角"上传视频"按钮跳转上传页

### 观看历史 /history（需登录）
- 展示当前用户观看过的视频，按观看时间倒序
- 每条记录：封面、标题、作者、观看时间，点击跳转详情页
- 右上角"清空历史"按钮（有二次确认弹窗）

### 个人资料 /profile（需登录）
- 显示头像（用户名首字母）、用户名、角色（普通用户/管理员）
- 修改邮箱：输入新邮箱点击"更新邮箱"
- 修改密码：输入新密码 + 确认密码，点击"更新密码"（至少6位）
- 操作结果通过 Toast 提示

## 导航栏（所有页面顶部）
- Logo 点击回首页
- 搜索框（桌面端）
- 未登录：显示"登录"和"注册"按钮
- 已登录：用户名下拉菜单（我的视频、观看历史、个人资料、退出登录）
- 右侧深色/浅色主题切换按钮
- 移动端底部导航栏：首页、搜索、上传、我的视频

## 视频状态
- 待审核（pending）：刚上传，仅上传者本人可见
- 已通过（approved）：公开展示在首页和搜索结果
- 已拒绝（rejected）：不公开，仅上传者可见

## 常见操作流程

### 如何上传视频
1. 登录 → 点击导航栏"上传"或访问 /upload
2. 选择视频文件（拖拽或点击）
3. 可选上传封面图
4. 填写标题、标签、简介
5. 点击"上传视频"等待完成
6. 在"我的视频"查看状态，等待管理员审核

### 如何找回密码
1. 访问 /forgot-password 或登录页点击"忘记密码"
2. 输入注册邮箱，点击发送
3. 查收邮件，点击重置链接（30分钟内有效）
4. 输入新密码确认

### 如何修改个人信息
1. 登录后点击右上角用户名 → 个人资料
2. 修改邮箱或密码，点击对应更新按钮

## 限制
- 不涉及管理后台相关功能，如被问到请回答"该功能不在助手服务范围内"

回答简洁准确，使用中文。"""

# ── 请求模型 ──────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

# ── 流式接口 ──────────────────────────────────────────────────────────────────

@router.post("/stream")
async def ai_stream(req: ChatRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    last_user_msg = next((m.content for m in reversed(req.messages) if m.role == "user"), "")

    action = _detect_action(last_user_msg)
    if action:
        extra = {}
        reply = ""
        if action["type"] == "search":
            extra["results"] = await _search_videos(action["keyword"], db)
            count = len(extra["results"])
            reply = f"找到 {count} 个关于「{action['keyword']}」的视频" if count else f"没有找到关于「{action['keyword']}」的视频"
        elif action["type"] == "my_videos":
            data = await _get_my_videos(current_user.id, db)
            extra["results"] = data["videos"]
            extra["stats"] = {"total": data["total"], "approved": data["approved"],
                              "pending": data["pending"], "rejected": data["rejected"]}
            reply = f"你共上传了 {data['total']} 个视频：已通过 {data['approved']} 个，待审核 {data['pending']} 个，已拒绝 {data['rejected']} 个"
        elif action["type"] == "my_history":
            extra["results"] = await _get_my_history(current_user.id, db)
            count = len(extra["results"])
            reply = f"你最近观看了 {count} 个视频" if count else "暂无观看记录"
        elif action["type"] == "play":
            reply = f"正在打开视频 {action['video_id']}"
        elif action["type"] == "navigate":
            names = {'/': '首页', '/login': '登录页', '/register': '注册页', '/upload': '上传页',
                     '/my-videos': '我的视频', '/history': '观看历史', '/profile': '个人资料', '/search': '搜索页'}
            reply = f"正在打开{names.get(action['url'], action['url'])}"
        elif action["type"] == "logout":
            reply = "正在退出登录"

        async def _quick():
            yield f"data: {json.dumps({'type': 'action', 'action': {**action, **extra}})}\n\n"
            yield f"data: {json.dumps({'type': 'text', 'content': reply})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_quick(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    # 问答类：走模型流式输出
    stats = await _platform_stats(db)
    top5_str = "\n".join([f"  {i+1}. [{v['id']}] {v['title']}（{v['views']}次）" for i, v in enumerate(stats["top5"])])
    newest5_str = "\n".join([f"  - [{v['id']}] {v['title']}（作者：{v['author']}）" for v in stats["newest5"]])
    realtime = f"""

## 当前平台实时数据
- 已发布视频：{stats['approved']} 个
- 待审核视频：{stats['pending']} 个
- 注册用户：{stats['users']} 人
- 总播放量：{stats['views']} 次

### 播放量 Top5
{top5_str or '暂无'}

### 最新发布
{newest5_str or '暂无'}"""

    messages = [{"role": "system", "content": SYSTEM_PROMPT + realtime}] + [m.model_dump() for m in req.messages]

    async def generate():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{LLAMA_URL}/v1/chat/completions",
                    json={"model": LLAMA_MODEL, "messages": messages, "stream": True},
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    async for line in resp.content:
                        text = line.decode().strip()
                        if not text or not text.startswith("data: "):
                            continue
                        raw = text[6:]
                        if raw == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            data = json.loads(raw)
                            chunk = data.get("choices", [{}])[0].get("delta", {}).get("content", "") or ""
                            if chunk:
                                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
