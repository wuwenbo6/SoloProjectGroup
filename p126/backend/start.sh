#!/bin/bash
echo "安装依赖..."
pip install -r requirements.txt

echo ""
echo "启动后端服务..."
echo "API文档将在 http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
