FROM golang:1.21-bullseye AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    clang \
    llvm \
    libbpf-dev \
    linux-headers-amd64 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN cd pkg/ebpf && go generate

RUN CGO_ENABLED=0 go build -o /bin/daemon ./cmd/daemon
RUN CGO_ENABLED=0 go build -o /bin/netpol-cli ./cmd/cli

FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /bin/daemon /usr/bin/daemon
COPY --from=builder /bin/netpol-cli /usr/bin/netpol-cli

ENTRYPOINT ["/usr/bin/daemon"]
