# 轻量级视频平台 (Video Platform)

一个基于 React + Flask 的现代化视频分享平台，具有简约美观的界面设计和完善的功能。

## 🌟 功能特性

### 前端功能
- ✅ 响应式设计，支持手机、平板、PC
- ✅ 视频搜索（按标题、作者、简介）
- ✅ 视频浏览和播放
- ✅ 用户注册和登录
- ✅ 视频上传（带进度条）
- ✅ 个人视频管理

### 后端功能
- ✅ JWT 认证
- ✅ 用户管理（CRUD）
- ✅ 视频管理（CRUD、审核）
- ✅ 视频抓取（从外部网站）
- ✅ 后台管理系统

### 安全特性
- ✅ SQL 注入防护（SQLAlchemy ORM）
- ✅ XSS 防护（输入验证）
- ✅ 文件上传类型验证
- ✅ JWT Token 认证

## 🛠 技术栈

### 前端
- React 18
- React Router 6
- Tailwind CSS
- Axios

### 后端
- Python 3.8+
- Flask 2.3
- Flask-SQLAlchemy
- Flask-JWT-Extended
- Flask-CORS
- BeautifulSoup4

## 📁 项目结构

```
videoplatform/
├── backend/                 # Flask 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── models.py       # 数据库模型
│   │   └── routes/
│   │       ├── auth.py     # 认证路由
│   │       ├── video.py    # 视频路由
│   │       └── admin.py    # 管理路由
│   ├── uploads/            # 上传文件存储
│   ├── database/           # SQLite 数据库
│   ├── config.py         # 配置文件
│   ├── requirements.txt  # Python 依赖
│   └── run.py            # 启动脚本
│
└── frontend/               # React 前端
    ├── public/
    ├── src/
    │   ├── components/     # 公共组件
    │   ├── contexts/       # React Context
    │   ├── pages/          # 页面组件
    │   │   └── admin/      # 管理后台页面
    │   ├── App.js
    │   └── index.js
    ├── package.json
    ├── tailwind.config.js
    └── postcss.config.js
```

## 🚀 快速开始

### 1. 启动后端

```bash
cd backend

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python run.py
```

后端服务将在 http://localhost:5000 启动

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端服务将在 http://localhost:3000 启动

### 3. 默认账号

- 管理员账号: `admin` / `admin123`

## 📋 功能说明

### 视频上传流程
1. 用户登录后点击"上传视频"
2. 选择视频文件（支持 MP4, AVI, MKV, MOV, WMV，最大 500MB）
3. 可选：上传封面图片
4. 填写标题、简介、标签
5. 提交后显示上传进度
6. 上传完成后等待管理员审核
7. 审核通过后在前端展示

### 视频抓取功能
1. 管理员进入后台管理 → 视频抓取
2. 输入视频页面URL
3. 系统自动抓取标题、简介、封面等信息
4. 确认后导入到平台

## 🔒 安全措施

1. **SQL注入防护**：使用 SQLAlchemy ORM，参数化查询
2. **XSS防护**：前端转义显示内容，后端验证输入
3. **文件上传安全**：验证文件类型、限制文件大小
4. **JWT认证**：Token 有效期 24 小时，密码加密存储

## 📄 许可证

MIT License
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/407c6c71-84e9-4571-b84e-94079fd0629b" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/2fc468c5-903c-4f22-a76e-e3d512bf7fc5" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/047bebea-7908-43b3-a780-0aabc75e7804" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/4804e997-fd14-43e3-add3-5f266dce4cd6" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/4a823e33-5955-471e-bdb5-47496a499c73" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/700e709e-7bc5-4cad-8ce3-341c015bce84" />
<img width="1813" height="1003" alt="image" src="https://github.com/user-attachments/assets/5703ba0f-14de-4bfe-b730-af6a2d5062c7" />



