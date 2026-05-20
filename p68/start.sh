#!/bin/bash

echo "========================================"
echo "  榫卯家具拆解教学平台 - 启动脚本"
echo "========================================"

# 检查Java版本
echo ""
echo "1. 检查Java环境..."
java -version

# 检查Node.js版本
echo ""
echo "2. 检查Node.js环境..."
node -v
npm -v

# 检查MySQL
echo ""
echo "3. 检查MySQL服务..."
mysql --version

echo ""
echo "========================================"
echo "  环境检查完成，请按以下步骤启动："
echo ""
echo "  后端启动 (新终端):"
echo "    cd backend"
echo "    mvn spring-boot:run"
echo ""
echo "  前端启动 (新终端):"
echo "    cd frontend"
echo "    npm install  (首次运行)"
echo "    npm run dev"
echo ""
echo "  数据库初始化:"
echo "    mysql -u root -p < backend/src/main/resources/init.sql"
echo ""
echo "========================================"
