.PHONY: all build generate clean

all: build

generate:
	cd cmd && go generate

build: generate
	go build -o http-latency ./cmd

clean:
	rm -f http-latency
	rm -f cmd/bpf_*.go
	rm -f *.folded
	rm -f *.db
