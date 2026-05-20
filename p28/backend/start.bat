@echo off
cd /d "%~dp0"

echo ======================================
echo   数字孪生后端服务启动脚本 (Windows)
echo ======================================
echo.

if not exist "node_modules" (
    echo 📦 安装Node.js依赖...
    call npm install
)

echo.
echo ✅ 依赖安装完成
echo 🚀 启动后端服务...
echo.

if "%1"=="--no-python" (
    echo ⚠️  Python预测服务已禁用
    set ENABLE_PYTHON_PREDICTION=false
)

call npm start
