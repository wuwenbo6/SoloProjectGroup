#!/bin/bash

echo "🎎 民俗活动记录平台 - 启动脚本"
echo "=================================="

# 检查 Node.js 是否已安装
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js (https://nodejs.org)"
    exit 1
fi

echo "✅ Node.js 已安装"

# 创建必要的目录
mkdir -p backend/uploads
mkdir -p backend/data

echo ""
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "⚠️  后端依赖安装失败，请手动执行: cd backend && npm install"
    else
        echo "✅ 后端依赖安装完成"
    fi
else
    echo "✅ 后端依赖已存在"
fi

echo ""
echo "📦 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "⚠️  前端依赖安装失败，请手动执行: cd frontend && npm install"
    else
        echo "✅ 前端依赖安装完成"
    fi
else
    echo "✅ 前端依赖已存在"
fi

echo ""
echo "=================================="
echo "🎉 项目初始化完成！"
echo ""
echo "📖 请按照以下步骤启动项目："
echo ""
echo "1. 启动后端服务（新开终端）："
echo "   cd backend && npm start"
echo "   后端运行在: http://localhost:3001"
echo ""
echo "2. 启动前端服务（新开终端）："
echo "   cd frontend && npm start"
echo "   前端运行在: http://localhost:3000"
echo ""
echo "📝 详细说明请查看 README.md"
echo ""
