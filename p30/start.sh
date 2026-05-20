#!/bin/bash

echo "========================================"
echo "  农田病虫害智能监测系统"
echo "  启动脚本"
echo "========================================"
echo ""

echo "请选择要启动的服务:"
echo "1) 启动边缘端"
echo "2) 启动后端"
echo "3) 启动前端"
echo "4) 全部启动"
echo "5) 退出"
echo ""
read -p "请输入选项 [1-5]: " choice

case $choice in
    1)
        echo "启动边缘端..."
        cd edge
        python main.py
        ;;
    2)
        echo "启动后端..."
        cd backend
        go run main.go
        ;;
    3)
        echo "启动前端..."
        cd frontend
        npm run dev
        ;;
    4)
        echo "启动全部服务..."
        echo "注意: 这将在后台运行所有服务"
        
        echo "启动后端 (端口 8080)..."
        cd backend
        go run main.go &
        BACKEND_PID=$!
        cd ..
        
        sleep 3
        
        echo "启动前端 (端口 3000)..."
        cd frontend
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        
        echo "启动边缘端..."
        cd edge
        python main.py &
        EDGE_PID=$!
        cd ..
        
        echo ""
        echo "========================================"
        echo "  所有服务已启动!"
        echo "  后端: http://localhost:8080"
        echo "  前端: http://localhost:3000"
        echo ""
        echo "  进程信息:"
        echo "  - 后端 PID: $BACKEND_PID"
        echo "  - 前端 PID: $FRONTEND_PID"
        echo "  - 边缘端 PID: $EDGE_PID"
        echo "========================================"
        echo ""
        echo "按 Ctrl+C 停止所有服务"
        wait
        ;;
    5)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac
