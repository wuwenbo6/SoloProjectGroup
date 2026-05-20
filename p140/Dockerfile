FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -o transcoder cmd/main.go

FROM alpine:3.18

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY --from=builder /app/transcoder .
COPY --from=builder /app/web ./web
COPY --from=builder /app/.env.example ./.env

EXPOSE 8080

CMD ["./transcoder"]
