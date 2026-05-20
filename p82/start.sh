#!/bin/bash

echo "Starting Ceramic API Service..."

if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
fi

echo "Installing dependencies..."
go mod download

echo "Building the application..."
go build -o ceramic-api main.go

echo "Starting the server..."
./ceramic-api
