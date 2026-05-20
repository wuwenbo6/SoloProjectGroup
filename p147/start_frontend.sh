#!/bin/bash

cd "$(dirname "$0")/frontend"

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# 启动开发服务器
echo "Starting frontend dev server on http://localhost:5173"
npm run dev
