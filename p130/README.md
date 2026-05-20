# Kademlia DHT Implementation

A distributed hash table implementation based on the Kademlia protocol with gRPC interface.

## Features

- Kademlia protocol implementation with routing table
- gRPC-based communication
- File chunked upload/download with SHA256 verification
- LevelDB for metadata storage
- UPnP NAT traversal
- File encryption (AES + RSA hybrid encryption)
- Node reputation system based on upload history
- Multi-source parallel downloading
- Docker-compose for multi-node testing

## Project Structure

```
.
├── cmd/
│   └── cli/
│       └── main.go          # CLI tool
├── pkg/
│   ├── dht/
│   │   └── server.go        # DHT server implementation
│   ├── kademlia/
│   │   └── node.go          # Kademlia core protocol
│   ├── storage/
│   │   └── leveldb.go       # LevelDB storage
│   └── nat/
│       └── upnp.go          # UPnP NAT traversal
├── proto/
│   └── dht.proto            # gRPC protocol definition
├── docker-compose.yml       # 3-node test environment
└── Dockerfile               # Container image
```

## Quick Start

### Prerequisites

- Go 1.21+
- Docker & Docker Compose
- protoc (for protobuf generation)

### Local Development

1. Install dependencies:
```bash
go mod tidy
```

2. Generate gRPC code:
```bash
protoc --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/dht.proto
```

3. Start seed node:
```bash
go run cmd/cli/main.go start --server :8000
```

4. Start another node (bootstrap to seed):
```bash
go run cmd/cli/main.go start --server :8001 --bootstrap localhost:8000
```

### Docker Multi-Node Test

1. Start 3 seed nodes:
```bash
docker-compose up -d
```

2. Check node status:
```bash
docker-compose logs -f
```

3. Stop nodes:
```bash
docker-compose down
```

## CLI Usage

### Start a node
```bash
dht-cli start [--server <address>] [--data <dir>] [--bootstrap <addr>]
```

### Publish a file
```bash
dht-cli publish <file-path> [--server <address>]
```

### Find a file
```bash
dht-cli find <file-id> [--server <address>]
```

### Download a file
```bash
dht-cli download <file-id> <output-path> [--server <address>]
```

## gRPC API

### Service Methods

- `Ping` - Node health check
- `FindNode` - Find nodes near target
- `FindValue` - Find file or near nodes
- `PublishFile` - Publish file chunk
- `GetChunk` - Download file chunk

## How It Works

1. **Node Discovery**: Each node maintains a routing table with k-buckets
2. **File Publishing**: Files split into 1MB chunks, metadata stored in DHT
3. **File Lookup**: Iterative lookup through closest nodes
4. **NAT Traversal**: UPnP for automatic port forwarding
5. **Encryption**: Files are encrypted with AES, and the AES key is encrypted with the publisher's RSA public key
6. **Reputation System**: Nodes are ranked based on upload volume and request success rate
7. **Parallel Downloading**: File chunks are downloaded simultaneously from multiple providers
