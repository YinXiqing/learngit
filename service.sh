#!/usr/bin/env bash
# 用法: ./service.sh [start|stop|restart|status]

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend-next"

start_backend() {
  echo "启动后端..."
  lsof -ti:5000 | xargs kill -9 2>/dev/null || true
  cd "$BACKEND_DIR"
  source .venv/bin/activate
  python run.py &
  echo "后端已启动 → http://localhost:5000"
}

start_frontend() {
  echo "启动前端..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  cd "$FRONTEND_DIR"
  [ ! -d node_modules ] && pnpm install
  pnpm dev &
  echo "前端已启动 → http://localhost:3000"
}

stop_all() {
  echo "停止所有服务..."
  pkill -f "uvicorn" 2>/dev/null || true
  pkill -f "python.*run.py" 2>/dev/null || true
  pkill -f "next" 2>/dev/null || true
  echo "已停止"
}

status() {
  lsof -ti:5000 >/dev/null 2>&1 && echo "后端: 运行中 (port 5000)" || echo "后端: 未运行"
  lsof -ti:3000 >/dev/null 2>&1 && echo "前端: 运行中 (port 3000)" || echo "前端: 未运行"
}

case "${1:-}" in
  start)   start_backend; start_frontend ;;
  stop)    stop_all ;;
  restart) stop_all; sleep 2; start_backend; start_frontend ;;
  status)  status ;;
  backend) start_backend ;;
  frontend) start_frontend ;;
  *) echo "用法: $0 [start|stop|restart|status|backend|frontend]"; exit 1 ;;
esac
