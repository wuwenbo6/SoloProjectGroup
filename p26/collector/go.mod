module github.com/tracetrace/collector

go 1.21

require (
	github.com/ClickHouse/clickhouse-go/v2 v2.15.0
	github.com/tracetrace/proto v0.0.0
	google.golang.org/grpc v1.59.0
	google.golang.org/protobuf v1.31.0
)

require (
	github.com/ClickHouse/ch-go v0.55.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/go-faster/city v1.0.1 // indirect
	github.com/go-faster/errors v0.6.1 // indirect
	github.com/golang/snappy v0.0.4 // indirect
	github.com/google/uuid v1.3.1 // indirect
	github.com/klauspost/compress v1.17.2 // indirect
	github.com/pierrec/lz4/v4 v4.1.17 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	golang.org/x/net v0.17.0 // indirect
	golang.org/x/sys v0.13.0 // indirect
	golang.org/x/text v0.13.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20231009163232-59a96871d4b8 // indirect
)

replace github.com/tracetrace/proto => ../proto
