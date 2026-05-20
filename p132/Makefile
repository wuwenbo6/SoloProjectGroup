.PHONY: build test clean docker-build docker-up docker-down

APP_NAME=modbus-mqtt-gateway

build:
	go build -o $(APP_NAME) ./cmd/gateway

test:
	go test -v ./pkg/...

test-race:
	go test -race -v ./pkg/...

test-coverage:
	go test -coverprofile=coverage.out ./pkg/...
	go tool cover -html=coverage.out -o coverage.html

clean:
	rm -f $(APP_NAME) coverage.out coverage.html

docker-build:
	docker build -t $(APP_NAME):latest .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

run: build
	./$(APP_NAME) start

status:
	./$(APP_NAME) status

reload:
	./$(APP_NAME) reload

fmt:
	go fmt ./...

vet:
	go vet ./...

lint: fmt vet

tidy:
	go mod tidy
