#!/bin/bash

cd "$(dirname "$0")/backend"

# 检查虚拟环境是否存在
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "Installing dependencies..."
pip install -r requirements.txt

# 创建uploads目录
mkdir -p uploads

# 启动服务器
echo "Starting backend server on http://localhost:8000"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
