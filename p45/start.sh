#!/bin/bash

echo "========================================"
echo "    联盟链浏览器 - 启动脚本"
echo "========================================"
echo ""

BASE_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$BASE_DIR"

echo "项目目录: $BASE_DIR"
echo ""

echo "========================================"
echo "步骤 1: 编译后端项目 (Maven)"
echo "========================================"
if command -v mvn &> /dev/null; then
    echo "开始编译..."
    mvn clean install -DskipTests
    if [ $? -ne 0 ]; then
        echo "Maven 编译失败！"
        exit 1
    fi
    echo "Maven 编译成功！"
else
    echo "警告: 未找到 mvn 命令，跳过编译阶段"
fi
echo ""

echo "========================================"
echo "步骤 2: 安装前端依赖 (npm)"
echo "========================================"
cd "$BASE_DIR/frontend"
if command -v npm &> /dev/null; then
    echo "安装 npm 依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "npm 安装失败！"
        exit 1
    fi
    echo "npm 依赖安装成功！"
else
    echo "警告: 未找到 npm 命令，跳过前端依赖安装"
fi
echo ""

echo "========================================"
echo "步骤 3: 启动各服务模块"
echo "========================================"
echo ""

LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"

echo "启动 Mock Chain (端口 8082)..."
cd "$BASE_DIR/mock-chain"
nohup mvn spring-boot:run > "$LOG_DIR/mock-chain.log" 2>&1 &
MOCK_CHAIN_PID=$!
echo "Mock Chain PID: $MOCK_CHAIN_PID"
sleep 5

echo "启动 Explorer API (端口 8080)..."
cd "$BASE_DIR/explorer-api"
nohup mvn spring-boot:run > "$LOG_DIR/explorer-api.log" 2>&1 &
EXPLORER_API_PID=$!
echo "Explorer API PID: $EXPLORER_API_PID"
sleep 5

echo "启动 Indexer (端口 8081)..."
cd "$BASE_DIR/indexer"
nohup mvn spring-boot:run > "$LOG_DIR/indexer.log" 2>&1 &
INDEXER_PID=$!
echo "Indexer PID: $INDEXER_PID"
sleep 5

echo "启动 Frontend (端口 3000)..."
cd "$BASE_DIR/frontend"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 3

echo ""
echo "========================================"
echo "服务启动完成！"
echo "========================================"
echo ""
echo "访问地址:"
echo "  前端界面:    http://localhost:3000"
echo "  Explorer API: http://localhost:8080/api"
echo "  Indexer:      http://localhost:8081"
echo "  Mock Chain:   http://localhost:8082"
echo ""
echo "日志文件目录: $LOG_DIR"
echo "进程 PID:"
echo "  Mock Chain:    $MOCK_CHAIN_PID"
echo "  Explorer API:  $EXPLORER_API_PID"
echo "  Indexer:       $INDEXER_PID"
echo "  Frontend:      $FRONTEND_PID"
echo ""
echo "停止服务命令: ./stop.sh"
echo ""

echo "$MOCK_CHAIN_PID" > "$BASE_DIR/.pids"
echo "$EXPLORER_API_PID" >> "$BASE_DIR/.pids"
echo "$INDEXER_PID" >> "$BASE_DIR/.pids"
echo "$FRONTEND_PID" >> "$BASE_DIR/.pids"