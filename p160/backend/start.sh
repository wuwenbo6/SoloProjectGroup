#!/bin/bash

cd "$(dirname "$0")"

echo "Starting Knowledge Graph Backend..."

if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Copying .env.example..."
    cp .env.example .env
    echo "Please edit .env with your configuration before running again."
    exit 1
fi

source .env

echo "Checking Python dependencies..."
pip install -q -r requirements.txt

echo "Downloading spaCy model (if needed)..."
python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || python -m spacy download en_core_web_sm

echo "Starting FastAPI server on http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
