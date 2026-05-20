#!/bin/bash

echo "Setting up Wi-Fi Probe Analytics System..."

if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "Go is not installed. Please install Go first."
    exit 1
fi

echo "Starting InfluxDB..."
docker-compose up -d

echo "Waiting for InfluxDB to initialize..."
sleep 15

if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please configure the following in .env file:"
    echo "  - MAP_API_KEY (Baidu Maps API key)"
    echo "  - INFLUXDB_TOKEN (if you changed it)"
else
    echo ".env file already exists."
fi

echo "Downloading Go dependencies..."
go mod download

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Baidu Maps API key"
echo "2. Run 'make run' to start the backend server"
echo "3. Visit http://localhost:8080 to view the dashboard"
echo "4. Run 'make simulator' to generate test data"
