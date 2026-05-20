#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="${SCRIPT_DIR}/proto"
OUT_DIR="${SCRIPT_DIR}/generated"

mkdir -p "${OUT_DIR}"

python -m grpc_tools.protoc \
    -I"${PROTO_DIR}" \
    --python_out="${OUT_DIR}" \
    --grpc_python_out="${OUT_DIR}" \
    "${PROTO_DIR}/anomaly_detection.proto"

echo "Protobuf generation completed. Output in: ${OUT_DIR}"
