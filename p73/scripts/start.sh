#!/bin/bash

echo "=================================="
echo "  酿酒发酵监控系统启动脚本"
echo "=================================="

echo ""
echo "启动后端服务..."
cd backend
go mod tidy
gnome-terminal -- bash -c "go run cmd/main.go; exec bash" &

sleep 3

echo ""
echo "启动前端服务..."
cd ../frontend
npm install
npm start
