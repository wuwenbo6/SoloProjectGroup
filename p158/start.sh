#!/bin/bash

echo "Starting Wi-Fi Probe Analytics System..."

echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

echo "Starting InfluxDB..."
docker-compose up -d influxdb

echo "Waiting for InfluxDB to be ready..."
sleep 10

echo "Checking Go..."
if ! command -v go &> /dev/null; then
    echo "Go is not installed. Please install Go first."
    exit 1
fi

if [ ! -f .env ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo "Please edit .env file with your configuration."
fi

echo "Downloading dependencies..."
go mod download

echo "Building application..."
go build -o wifi-probe-analytics main.go

echo "Starting application..."
./wifi-probe-analytics
