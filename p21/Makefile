.PHONY: build server worker docker-up docker-down test

build:
	go build -o bin/server ./cmd/server
	go build -o bin/worker ./cmd/worker

server:
	go run ./cmd/server

worker:
	go run ./cmd/worker

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down -v

test:
	go test ./...

deps:
	go mod download
	go mod tidy
