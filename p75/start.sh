#!/bin/bash

echo "============================================="
echo "打字机字符采集监控系统 - 启动脚本"
echo "============================================="

echo ""
echo "检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    exit 1
fi
echo "✅ Python3 已安装"

echo ""
echo "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi
echo "✅ Node.js 已安装"

echo ""
echo "============================================="
echo "启动后端服务 (FastAPI)..."
echo "============================================="
cd backend

if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境并安装依赖..."
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "启动 FastAPI 服务器 (端口 8000)..."
echo "API 文档: http://localhost:8000/docs"
python main.py &
BACKEND_PID=$!

echo ""
echo "============================================="
echo "启动前端服务 (React)..."
echo "============================================="
cd ../frontend

echo "安装 npm 依赖..."
npm install

echo ""
echo "启动 React 开发服务器 (端口 3000)..."
echo "访问地址: http://localhost:3000"
npm start

echo ""
echo "正在关闭后端服务..."
kill $BACKEND_PID
echo "服务已全部停止"