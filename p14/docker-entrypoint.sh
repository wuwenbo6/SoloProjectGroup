#!/bin/bash
set -e

echo "🚀 启动数据分析平台..."
echo "环境: $ENVIRONMENT"

# 等待依赖服务就绪
echo "等待依赖服务就绪..."
./wait-for-it.sh redis:6379 --timeout=30 -- echo "✅ Redis就绪"
./wait-for-it.sh postgres:5432 --timeout=30 -- echo "✅ PostgreSQL就绪"
./wait-for-it.sh kafka:9092 --timeout=60 -- echo "✅ Kafka就绪"

echo "所有依赖服务就绪!"

# 数据库迁移（如果需要）
# python manage.py migrate

# 启动主应用
exec "$@"
