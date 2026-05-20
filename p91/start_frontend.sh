#!/bin/bash

cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --legacy-peer-deps --no-cache
fi

echo "Starting frontend server..."
npm run dev
