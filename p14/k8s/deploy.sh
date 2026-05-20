#!/bin/bash
# Kubernetes一键部署脚本
set -e

echo "=========================================="
echo "  数据分析平台 - Kubernetes一键部署"
echo "=========================================="

# 检查kubectl是否安装
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl未安装，请先安装kubectl"
    exit 1
fi

# 检查集群连接
echo "🔍 检查Kubernetes集群连接..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ 无法连接到Kubernetes集群，请检查配置"
    exit 1
fi
echo "✅ 集群连接正常"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 部署步骤
echo ""
echo "📦 开始部署..."

# 1. 创建命名空间
echo "1/8 创建命名空间..."
kubectl apply -f "$SCRIPT_DIR/namespace.yml"

# 2. 部署配置和密钥
echo "2/8 部署配置和密钥..."
kubectl apply -f "$SCRIPT_DIR/configmap.yml"
kubectl apply -f "$SCRIPT_DIR/secrets.yml"

# 3. 部署Redis
echo "3/8 部署Redis..."
kubectl apply -f "$SCRIPT_DIR/redis.yml"

# 4. 部署PostgreSQL
echo "4/8 部署PostgreSQL..."
kubectl apply -f "$SCRIPT_DIR/postgres.yml"

# 5. 部署Zookeeper和Kafka
echo "5/8 部署Zookeeper和Kafka..."
kubectl apply -f "$SCRIPT_DIR/kafka.yml"

# 6. 等待基础服务就绪
echo "6/8 等待基础服务就绪..."
kubectl wait --for=condition=ready pod -l app=redis -n analytics-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgres -n analytics-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=zookeeper -n analytics-platform --timeout=300s

# 7. 部署应用
echo "7/8 部署主应用..."
kubectl apply -f "$SCRIPT_DIR/app.yml"

# 8. 部署Ingress
echo "8/8 部署Ingress..."
kubectl apply -f "$SCRIPT_DIR/ingress.yml"

echo ""
echo "✅ 所有资源已部署完成!"
echo ""
echo "📊 部署状态:"
kubectl get pods -n analytics-platform

echo ""
echo "🌐 服务列表:"
kubectl get services -n analytics-platform

echo ""
echo "⏳ 等待应用完全启动..."
kubectl wait --for=condition=ready pod -l app=analytics-app -n analytics-platform --timeout=300s

echo ""
echo "=========================================="
echo "  🚀 平台部署完成!"
echo "=========================================="
echo ""
echo "📝 后续操作:"
echo "1. 查看Pod日志: kubectl logs -f <pod-name> -n analytics-platform"
echo "2. 查看Ingress: kubectl get ingress -n analytics-platform"
echo "3. 查看HPA状态: kubectl get hpa -n analytics-platform"
echo "4. 访问平台: https://analytics.example.com (需配置DNS)"
echo ""
