#!/bin/bash

echo "🧬 Gene Sequence Alignment System - Starting..."

echo ""
echo "Checking dependencies..."
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found. Please install MongoDB first."
fi

if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis not found. Please install Redis first."
fi

echo ""
echo "Creating directories..."
mkdir -p uploads

echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "Starting services..."
echo ""
echo "You need to start the following services in separate terminals:"
echo ""
echo "1. Start MongoDB:"
echo "   mongod --dbpath ./data/db"
echo ""
echo "2. Start Redis:"
echo "   redis-server"
echo ""
echo "3. Start Celery worker:"
echo "   celery -A app.tasks.celery_config.celery_app worker --loglevel=info"
echo ""
echo "4. Start FastAPI server:"
echo "   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "Then open http://localhost:8000 in your browser"
