#!/bin/bash

echo "=== 古地图扫描件标注系统 ==="
echo ""

echo "1. 修复npm权限（如需要）..."
echo "   sudo chown -R 501:20 \"$HOME/.npm\""
echo ""

echo "2. 安装后端依赖..."
npm install
echo ""

echo "3. 安装前端依赖..."
cd client
npm install
cd ..
echo ""

echo "4. 创建必要目录..."
mkdir -p uploads
mkdir -p data
echo ""

echo "安装完成！"
echo ""
echo "启动方式："
echo "  - 同时启动前后端: npm run dev"
echo "  - 单独启动后端: npm run server"
echo "  - 单独启动前端: cd client && npm start"
echo ""
echo "访问地址:"
echo "  - 前端: http://localhost:3000"
echo "  - 后端API: http://localhost:5000"
