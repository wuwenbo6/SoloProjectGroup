#!/bin/bash

echo "========================================"
echo "    联盟链浏览器 - 停止脚本"
echo "========================================"
echo ""

BASE_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$BASE_DIR"

PID_FILE="$BASE_DIR/.pids"

if [ -f "$PID_FILE" ]; then
    echo "正在停止所有服务..."
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "停止进程 PID: $pid"
            kill "$pid"
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                echo "强制终止进程 PID: $pid"
                kill -9 "$pid"
            fi
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
    echo ""
    echo "所有服务已停止！"
else
    echo "未找到 PID 文件，尝试查找相关进程..."
    
    pids=$(ps aux | grep -E "(spring-boot|next|node)" | grep java | awk '{print $2}')
    
    if [ -n "$pids" ]; then
        for pid in $pids; do
            echo "停止进程 PID: $pid"
            kill "$pid" 2>/dev/null
        done
        sleep 3
        
        remaining=$(ps aux | grep -E "(spring-boot|next|node)" | grep java | awk '{print $2}')
        if [ -n "$remaining" ]; then
            for pid in $remaining; do
                echo "强制终止进程 PID: $pid"
                kill -9 "$pid" 2>/dev/null
            done
        fi
    else
        echo "未找到运行的相关进程"
    fi
fi

echo ""
echo "停止完成！"