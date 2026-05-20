#!/bin/bash

cd "$(dirname "$0")"

echo "======================================"
echo "  数字孪生后端服务启动脚本"
echo "======================================"
echo ""

if [ ! -d "node_modules" ]; then
    echo "📦 安装Node.js依赖..."
    npm install
fi

echo "🐍 检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "⚠️  未找到python3，尝试使用python..."
    PYTHON_CMD="python"
else
    PYTHON_CMD="python3"
fi

cd ml_service
if [ ! -d "venv" ]; then
    echo "🐍 创建Python虚拟环境..."
    $PYTHON_CMD -m venv venv
fi

echo "🐍 激活Python环境并安装依赖..."
source venv/bin/activate
pip install -q aiohttp numpy
deactivate
cd ..

echo ""
echo "✅ 依赖安装完成"
echo "🚀 启动后端服务..."
echo ""

if [ "$1" = "--no-python" ]; then
    echo "⚠️  Python预测服务已禁用（使用JS实现）"
    export ENABLE_PYTHON_PREDICTION=false
fi

npm start
