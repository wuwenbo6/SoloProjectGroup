.PHONY: all build generate ebpf-build clean docker-build

IMAGE_NAME := netpol-ebpf
IMAGE_TAG := latest

all: generate build

generate:
	cd pkg/ebpf && go generate

ebpf-build:
	clang -O2 -g -Wall -Werror -target bpf -D__TARGET_ARCH_x86 -c bpf/netpol.c -o bpf/netpol.o

build:
	go build -o bin/daemon ./cmd/daemon
	go build -o bin/netpol-cli ./cmd/cli

clean:
	rm -rf bin/
	rm -f pkg/ebpf/bpf_*.go
	rm -f bpf/*.o

docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

test:
	go test -v ./...

lint:
	golangci-lint run

run-daemon:
	sudo ./bin/daemon --iface eth0

run-cli:
	sudo ./bin/netpol-cli
