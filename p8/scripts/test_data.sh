#!/bin/bash

echo "========================================"
echo "  Sending Test Data to Core Service"
echo "========================================"
echo ""

TIMESTAMP=$(date +%s%3N)

echo "1. Sending normal temperature data..."
curl -X POST http://localhost:8080/api/v1/data \
    -H "Content-Type: application/json" \
    -d "{
        \"data_points\": [
            {
                \"device_id\": \"device-001\",
                \"timestamp\": ${TIMESTAMP},
                \"metrics\": {
                    \"temperature\": 25.5,
                    \"humidity\": 60.0,
                    \"pressure\": 1013.2
                }
            }
        ]
    }"
echo ""
echo ""

echo "2. Sending anomaly data (high temperature)..."
TIMESTAMP2=$(date +%s%3N)
curl -X POST http://localhost:8080/api/v1/data \
    -H "Content-Type: application/json" \
    -d "{
        \"data_points\": [
            {
                \"device_id\": \"device-001\",
                \"timestamp\": ${TIMESTAMP2},
                \"metrics\": {
                    \"temperature\": 100.0,
                    \"humidity\": 65.0,
                    \"voltage\": 220.0
                }
            }
        ]
    }"
echo ""
echo ""

echo "3. Sending batch data with multiple devices..."
TIMESTAMP3=$(date +%s%3N)
curl -X POST http://localhost:8080/api/v1/data \
    -H "Content-Type: application/json" \
    -d "{
        \"data_points\": [
            {
                \"device_id\": \"device-001\",
                \"timestamp\": ${TIMESTAMP3},
                \"metrics\": {
                    \"temperature\": 26.0,
                    \"humidity\": 58.0
                }
            },
            {
                \"device_id\": \"device-002\",
                \"timestamp\": ${TIMESTAMP3},
                \"metrics\": {
                    \"temperature\": 24.5,
                    \"humidity\": 62.0,
                    \"current\": 15.5
                }
            }
        ]
    }"
echo ""
echo ""

echo "4. Checking anomalies for device-001..."
curl "http://localhost:8080/api/v1/devices/device-001/anomalies"
echo ""
echo ""

echo "5. Health check..."
curl http://localhost:8080/health
echo ""
echo ""
echo "Done!"
