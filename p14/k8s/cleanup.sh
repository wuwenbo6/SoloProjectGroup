#!/bin/bash
# Kubernetes清理脚本
set -e

echo "=========================================="
echo "  数据分析平台 - Kubernetes清理工具"
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

echo ""
read -p "⚠️  确定要删除整个analytics-platform命名空间吗？这将删除所有数据！(y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消操作"
    exit 0
fi

echo "🗑️  开始清理..."
echo ""

# 删除命名空间（会删除该命名空间下所有资源）
echo "删除命名空间 analytics-platform..."
kubectl delete namespace analytics-platform --timeout=300s || true

echo ""
echo "✅ 清理完成!"
echo ""
echo "📝 验证:"
kubectl get namespaces | grep -E "(analytics-platform|NAME)" || echo "analytics-platform命名空间已不存在"
echo ""
