#!/bin/bash

echo "========================================"
echo "方言语音合成系统 - 启动脚本"
echo "========================================"

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "启动后端服务..."
cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "创建Python虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

python -c "from models.database import init_db; init_db()"
echo "数据库初始化完成"

uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo ""
echo "启动前端服务..."
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "服务启动完成！"
echo "后端API: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo "前端界面: http://localhost:3000"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
