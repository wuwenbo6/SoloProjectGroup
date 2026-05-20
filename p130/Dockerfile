FROM golang:1.21-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .

RUN go build -o dht-node ./cmd/cli

EXPOSE 8000 8001 8002

CMD ["./dht-node", "start"]
