@echo off
echo ========================================
echo    轻量级视频平台启动脚本
echo ========================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Python，请先安装Python 3.11
    pause
    exit /b 1
)

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

echo.
echo 请选择要执行的操作：
echo 1. 初始化数据库
echo 2. 启动后端服务器
echo 3. 启动前端服务器
echo 4. 同时启动前后端服务器
echo 5. 退出
echo.
set /p choice=请输入选项 (1-5): 

if "%choice%"=="1" goto init_db
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto start_both
if "%choice%"=="5" goto end
echo 无效选项，请重新选择
goto start

:init_db
echo.
echo [信息] 正在初始化数据库...
cd backend
if not exist venv (
    echo [信息] 创建虚拟环境...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
python init_db.py
echo.
echo [成功] 数据库初始化完成！
echo 默认管理员账号: admin / admin123
pause
goto start

:start_backend
echo.
echo [信息] 正在启动后端服务器...
cd backend
if not exist venv (
    echo [错误] 虚拟环境不存在，请先执行选项1初始化
    pause
    goto start
)
call venv\Scripts\activate.bat
python run.py
goto end

:start_frontend
echo.
echo [信息] 正在启动前端服务器...
cd frontend
if not exist node_modules (
    echo [信息] 安装前端依赖...
    npm install
)
npm start
goto end

:start_both
echo.
echo [信息] 正在同时启动前后端服务器...
echo [信息] 启动后端服务器...
start "后端服务器" cmd /k "cd backend && venv\Scripts\activate.bat && python run.py"
timeout /t 3 >nul
echo [信息] 启动前端服务器...
cd frontend
if not exist node_modules (
    echo [信息] 安装前端依赖...
    npm install
)
npm start
goto end

:end
echo.
echo 程序已退出
pause
