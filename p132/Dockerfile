FROM golang:1.21-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o modbus-mqtt-gateway ./cmd/gateway

FROM alpine:latest

RUN apk --no-cache add ca-certificates sqlite-libs

WORKDIR /root/

COPY --from=builder /app/modbus-mqtt-gateway .
COPY --from=builder /app/configs ./configs

EXPOSE 8080

CMD ["./modbus-mqtt-gateway", "start"]
