.PHONY: all build proto test clean docker-up docker-down

all: build

proto:
	protoc --go_out=. --go_opt=paths=source_relative \
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \
		proto/dht.proto

build: proto
	go build -o bin/dht-cli ./cmd/cli

test:
	go test ./...

clean:
	rm -rf bin/ data/

docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f
