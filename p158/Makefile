.PHONY: build run test clean deps up down

build:
	go build -o bin/wifi-probe-analytics main.go

run:
	go run main.go

test:
	go test -v ./...

clean:
	rm -rf bin/

deps:
	go mod download
	go mod tidy

up:
	docker-compose up -d

down:
	docker-compose down

simulator:
	go run test/simulator.go

all: deps up build
