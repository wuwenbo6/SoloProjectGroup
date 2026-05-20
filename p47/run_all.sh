#!/bin/bash

echo "=========================================="
echo "   害虫声纹监测系统 - 启动脚本"
echo "=========================================="

echo ""
echo "[1/4] 检查Python环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装"
    exit 1
fi
echo "✅ Python3 已安装"

echo ""
echo "[2/4] 初始化数据库..."
cd api
python3 manage.py migrate --noinput
cd ..
python3 init_db.py

echo ""
echo "[3/4] 启动Django后端服务..."
echo "   后端地址: http://localhost:8000"
echo ""

cd api
python3 manage.py runserver 0.0.0.0:8000
