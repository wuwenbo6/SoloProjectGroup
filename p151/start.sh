#!/bin/bash

echo "🚀 启动舆情监控系统..."

echo "📦 检查Docker服务..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

echo "🐳 启动Elasticsearch和Redis..."
docker-compose up -d

echo "⏳ 等待Elasticsearch启动..."
until curl -s http://localhost:9200 > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Elasticsearch已启动"

echo "📚 安装Python依赖..."
pip install -r requirements.txt > /dev/null 2>&1 || pip3 install -r requirements.txt

echo "🌐 启动后端服务..."
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &

sleep 3

echo ""
echo "🎉 系统启动完成！"
echo "📊 管理后台: http://localhost:8000/dashboard"
echo "🔧 API文档: http://localhost:8000/docs"
echo "💾 Elasticsearch: http://localhost:9200"
echo "🔴 Redis: localhost:6379"
echo ""
echo "按 Ctrl+C 停止服务"
wait
