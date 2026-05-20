#!/bin/bash

cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt
pip install email-validator

echo "Starting backend server..."
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
