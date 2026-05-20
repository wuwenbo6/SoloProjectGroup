#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

echo "========================================"
echo "  IoT Microservices - Starting Stack"
echo "========================================"

cd "${PROJECT_ROOT}"

echo ""
echo "Creating necessary directories..."
mkdir -p core-service/pb/device
mkdir -p core-service/pb/anomaly

echo ""
echo "Generating Go Protobuf files..."

if command -v protoc &> /dev/null; then
    cd "${PROJECT_ROOT}/core-service"

    protoc --go_out=./pb/device --go_opt=paths=source_relative \
        --go-grpc_out=./pb/device --go-grpc_opt=paths=source_relative \
        -I./proto proto/device_data.proto

    protoc --go_out=./pb/anomaly --go_opt=paths=source_relative \
        --go-grpc_out=./pb/anomaly --go-grpc_opt=paths=source_relative \
        -I./proto proto/anomaly_detection.proto

    echo "Go Protobuf files generated successfully"
else
    echo "protoc not found, skipping Go protobuf generation"
fi

cd "${PROJECT_ROOT}"

echo ""
echo "Generating Python Protobuf files..."

cd "${PROJECT_ROOT}/anomaly-detection"
bash generate_proto.sh

cd "${PROJECT_ROOT}"

echo ""
echo "Starting Docker Compose..."
docker-compose up -d

echo ""
echo "========================================"
echo "  Services are starting!"
echo "========================================"
echo ""
echo "Available Services:"
echo "  - Core Service HTTP:    http://localhost:8080"
echo "  - Core Service gRPC:    localhost:50051"
echo "  - InfluxDB:             http://localhost:8086"
echo "  - PostgreSQL:           localhost:5432"
echo "  - Prometheus:           http://localhost:9090"
echo "  - Grafana:              http://localhost:3000 (admin/admin)"
echo "  - Anomaly Detection:    localhost:50052"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo ""
