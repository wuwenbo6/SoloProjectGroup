FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto/ ./proto/
COPY src/ ./src/
COPY generated/ ./generated/

RUN cd /app && python -m grpc_tools.protoc \
    -I./proto \
    --python_out=./generated \
    --grpc_python_out=./generated \
    ./proto/anomaly_detection.proto

EXPOSE 50052 8000

CMD ["python", "src/server.py"]
