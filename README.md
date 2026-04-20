# 轻量级视频平台 (Video Platform)

一个基于 Next.js + FastAPI 的现代化视频分享平台。

## 🛠 技术栈

### 前端
- Next.js 16 + React 19
- TypeScript
- Tailwind CSS 4
- Axios

### 后端
- Python 3.12
- FastAPI + Uvicorn（异步）
- SQLAlchemy 2.0（asyncio）
- PostgreSQL（asyncpg）
- python-jose（JWT）
- bcrypt
- yt-dlp + BeautifulSoup4（视频抓取）

## 📁 项目结构

```
videoplatform/
├── service.sh               # 服务管理脚本
├── backend/
│   ├── app/
│   │   ├── __init__.py      # FastAPI 应用工厂
│   │   ├── models.py        # 数据库模型（User, Video, ScrapedVideoInfo）
│   │   ├── database.py      # 异步数据库引擎
│   │   ├── deps.py          # 依赖注入
│   │   └── routes/
│   │       ├── auth.py      # 认证路由
│   │       ├── video.py     # 视频路由
│   │       └── admin.py     # 管理路由
│   ├── uploads/             # 上传文件存储
│   ├── config.py            # 配置（pydantic-settings）
│   ├── requirements.txt
│   └── run.py               # uvicorn 启动入口
│
└── frontend-next/
    ├── app/                 # Next.js App Router
    │   ├── page.tsx         # 首页
    │   ├── login/
    │   ├── register/
    │   ├── profile/
    │   ├── upload/
    │   ├── search/
    │   ├── my-videos/
    │   ├── video/[id]/
    │   └── admin/
    │       ├── page.tsx
    │       ├── users/
    │       ├── videos/
    │       └── scraper/
    ├── components/          # 公共组件
    ├── contexts/            # AuthContext
    ├── lib/                 # API 工具
    └── types/
```

## 🚀 快速开始

### 前置条件

- PostgreSQL 数据库，创建数据库和用户：
  ```sql
  CREATE USER videoplatform WITH PASSWORD 'videoplatform';
  CREATE DATABASE videoplatform OWNER videoplatform;
  ```

### 1. 配置后端环境变量

编辑 `backend/.env`，按需修改数据库连接等配置：

```env
DATABASE_URL=postgresql+asyncpg://videoplatform:videoplatform@localhost/videoplatform
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
```

### 2. 启动后端

```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
python run.py
```

后端 API 服务将在 http://localhost:5000 启动，API 文档见 http://localhost:5000/docs

### 3. 启动前端

```bash
cd frontend-next
pnpm install
pnpm dev
```

前端服务将在 http://localhost:3000 启动

### 4. 使用 service.sh 管理服务

```bash
./service.sh start     # 同时启动前后端
./service.sh stop      # 停止所有服务
./service.sh restart   # 重启
./service.sh status    # 查看运行状态
./service.sh backend   # 仅启动后端
./service.sh frontend  # 仅启动前端
```

### 5. 默认管理员账号

- 用户名: `admin` / 密码: `admin123`

## 🌟 功能特性

- 视频浏览、搜索（按标题、作者、简介）
- 用户注册、登录（JWT 认证，24 小时有效期）
- 视频上传（MP4/AVI/MKV/MOV/WMV/FLV，最大 500MB），支持封面图片
- 上传后需管理员审核才公开展示
- 个人视频管理
- 管理后台：用户管理、视频审核、视频抓取（yt-dlp）

## 🔒 安全措施

- JWT Token 认证
- bcrypt 密码加密
- SQLAlchemy ORM 参数化查询（防 SQL 注入）
- 文件上传类型和大小校验

## 📄 许可证

MIT License
