package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	_ "net/http/pprof"

	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"

	pb "github.com/tracetrace/proto"
)

const (
	DefaultRatePerSecond    = 100000
	DefaultMaxConcurrent    = 1000
	DefaultMaxQueueSize     = 1000000
	DefaultWorkerCount      = 64
	DefaultBatchSize        = 1000
	DefaultDataDir          = "./data/collector"
	DefaultGRPCPort         = 4317
	DefaultHTTPPort         = 8081
)

type TraceCollectorServer struct {
	pb.UnimplementedTraceServiceServer
	clickhouse     *ClickHouseClient
	rateLimiter    *RateLimitInterceptor
	batchProcessor *BatchProcessor
	stats          *ServerStats
}

type ServerStats struct {
	SpansReceived    int64
	SpansInserted    int64
	SpansDropped     int64
	TotalBatches     int64
	DroppedBatches   int64
	Errors           int64
	mu               sync.Mutex
}

type BatchProcessor struct {
	inputChan    chan []byte
	workerCount  int
	batchSize    int
	clickhouse   *ClickHouseClient
	wg           sync.WaitGroup
	closeChan    chan struct{}
	closed       bool
	mu           sync.Mutex
}

func NewBatchProcessor(clickhouse *ClickHouseClient, workerCount int, batchSize int, queueSize int) *BatchProcessor {
	return &BatchProcessor{
		inputChan:   make(chan []byte, queueSize),
		workerCount: workerCount,
		batchSize:   batchSize,
		clickhouse:  clickhouse,
		closeChan:   make(chan struct{}),
	}
}

func (bp *BatchProcessor) Start() {
	for i := 0; i < bp.workerCount; i++ {
		bp.wg.Add(1)
		go bp.worker(i)
	}
}

func (bp *BatchProcessor) worker(id int) {
	defer bp.wg.Done()

	buffer := make([]*pb.Span, 0, bp.batchSize)
	timer := time.NewTimer(100 * time.Millisecond)
	defer timer.Stop()

	for {
		select {
		case <-bp.closeChan:
			if len(buffer) > 0 {
				bp.flush(buffer)
			}
			return
		case data := <-bp.inputChan:
			var span pb.Span
			if err := json.Unmarshal(data, &span); err != nil {
				log.Printf("Worker %d: failed to unmarshal span: %v", id, err)
				continue
			}
			buffer = append(buffer, &span)

			if len(buffer) >= bp.batchSize {
				bp.flush(buffer)
				buffer = buffer[:0]
				timer.Reset(100 * time.Millisecond)
			}
		case <-timer.C:
			if len(buffer) > 0 {
				bp.flush(buffer)
				buffer = buffer[:0]
			}
			timer.Reset(100 * time.Millisecond)
		}
	}
}

func (bp *BatchProcessor) flush(spans []*pb.Span) {
	if len(spans) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := bp.clickhouse.InsertSpans(ctx, spans); err != nil {
		log.Printf("Failed to insert %d spans: %v", len(spans), err)
	}
}

func (bp *BatchProcessor) Submit(data []byte) bool {
	select {
	case bp.inputChan <- data:
		return true
	default:
		return false
	}
}

func (bp *BatchProcessor) Stop() {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	if bp.closed {
		return
	}
	bp.closed = true

	close(bp.closeChan)
	bp.wg.Wait()
	close(bp.inputChan)
}

func (s *TraceCollectorServer) Export(ctx context.Context, req *pb.ExportTraceServiceRequest) (*pb.ExportTraceServiceResponse, error) {
	spanCount := len(req.Spans)
	if spanCount == 0 {
		return &pb.ExportTraceServiceResponse{
			Success: true,
			Message: "No spans to process",
		}, nil
	}

	for _, span := range req.Spans {
		data, err := json.Marshal(span)
		if err != nil {
			continue
		}

		if !s.batchProcessor.Submit(data) {
			diskQueue := s.rateLimiter.GetDiskQueue()
			if err := diskQueue.Push(data); err != nil {
				log.Printf("Failed to enqueue span: %v", err)
			}
		}
	}

	return &pb.ExportTraceServiceResponse{
		Success: true,
		Message: fmt.Sprintf("Accepted %d spans", spanCount),
	}, nil
}

func (s *TraceCollectorServer) StartDiskQueueConsumer() {
	diskQueue := s.rateLimiter.GetDiskQueue()

	go func() {
		for {
			select {
			case <-s.batchProcessor.closeChan:
				return
			default:
				data, err := diskQueue.PopWithTimeout(10 * time.Millisecond)
				if err == ErrQueueEmpty {
					time.Sleep(50 * time.Millisecond)
					continue
				}
				if err != nil {
					log.Printf("Disk queue pop error: %v", err)
					time.Sleep(100 * time.Millisecond)
					continue
				}

				for !s.batchProcessor.Submit(data) {
					select {
					case <-s.batchProcessor.closeChan:
						return
					default:
						time.Sleep(10 * time.Millisecond)
					}
				}
			}
		}
	}()
}

func getEnvInt(key string, defaultValue int) int {
	if value, ok := os.LookupEnv(key); ok {
		if v, err := strconv.Atoi(value); err == nil {
			return v
		}
	}
	return defaultValue
}

func (s *ServerStats) incrementReceived(count int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.SpansReceived += count
}

func (s *ServerStats) incrementInserted(count int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.SpansInserted += count
}

func (s *ServerStats) incrementDropped(count int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.SpansDropped += count
}

func (s *ServerStats) getStats() map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()

	return map[string]interface{}{
		"spans_received":   s.SpansReceived,
		"spans_inserted":   s.SpansInserted,
		"spans_dropped":    s.SpansDropped,
		"total_batches":    s.TotalBatches,
		"dropped_batches":  s.DroppedBatches,
		"errors":           s.Errors,
	}
}

func main() {
	ratePerSecond := getEnvInt("RATE_PER_SECOND", DefaultRatePerSecond)
	maxConcurrent := getEnvInt("MAX_CONCURRENT", DefaultMaxConcurrent)
	maxQueueSize := getEnvInt("MAX_QUEUE_SIZE", DefaultMaxQueueSize)
	workerCount := getEnvInt("WORKER_COUNT", DefaultWorkerCount)
	grpcPort := getEnvInt("GRPC_PORT", DefaultGRPCPort)
	httpPort := getEnvInt("HTTP_PORT", DefaultHTTPPort)
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = DefaultDataDir
	}

	os.MkdirAll(dataDir, 0755)

	clickhouseAddr := os.Getenv("CLICKHOUSE_ADDR")
	if clickhouseAddr == "" {
		clickhouseAddr = "clickhouse:9000"
	}

	clickhouse, err := NewClickHouseClient(fmt.Sprintf("clickhouse://%s?database=traces", clickhouseAddr))
	if err != nil {
		log.Fatalf("Failed to connect to ClickHouse: %v", err)
	}
	defer clickhouse.Close()

	if err := clickhouse.CreateTables(); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	rateLimiter, err := NewRateLimitInterceptor(
		int64(ratePerSecond),
		maxConcurrent,
		int64(maxQueueSize),
		dataDir,
	)
	if err != nil {
		log.Fatalf("Failed to create rate limiter: %v", err)
	}
	defer rateLimiter.Close()

	batchProcessor := NewBatchProcessor(
		clickhouse,
		workerCount,
		DefaultBatchSize,
		maxQueueSize,
	)
	batchProcessor.Start()
	defer batchProcessor.Stop()

	stats := &ServerStats{}

	server := &TraceCollectorServer{
		clickhouse:     clickhouse,
		rateLimiter:    rateLimiter,
		batchProcessor: batchProcessor,
		stats:          stats,
	}

	server.StartDiskQueueConsumer()

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(rateLimiter.UnaryInterceptor()),
		grpc.StreamInterceptor(rateLimiter.StreamInterceptor()),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle:     5 * time.Minute,
			MaxConnectionAge:      30 * time.Minute,
			MaxConnectionAgeGrace: 5 * time.Second,
			Time:                  1 * time.Hour,
			Timeout:               20 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Minute,
			PermitWithoutStream: true,
		}),
		grpc.MaxRecvMsgSize(1024*1024*64),
		grpc.MaxSendMsgSize(1024*1024*64),
		grpc.MaxConcurrentStreams(uint32(maxConcurrent)),
		grpc.ConnectionTimeout(30 * time.Second),
	)

	pb.RegisterTraceServiceServer(grpcServer, server)
	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", grpcPort))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	httpMux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		stats := server.stats.getStats()
		limiterStats := rateLimiter.GetStats()

		for k, v := range limiterStats {
			stats[k] = v
		}

		json.NewEncoder(w).Encode(stats)
	})
	httpMux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		stats := server.stats.getStats()
		limiterStats := rateLimiter.GetStats()

		for k, v := range limiterStats {
			stats[k] = v
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "running",
			"stats":  stats,
		})
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", httpPort),
		Handler: httpMux,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, syscall.SIGTERM, syscall.SIGINT, syscall.SIGQUIT)

	go func() {
		log.Printf("Starting gRPC server on :%d", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Failed to serve gRPC: %v", err)
		}
	}()

	go func() {
		log.Printf("Starting HTTP server on :%d", httpPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to serve HTTP: %v", err)
		}
	}()

	log.Println("Trace collector started successfully")
	log.Printf("Configuration: rate=%d/s, max_concurrent=%d, max_queue=%d, workers=%d",
		ratePerSecond, maxConcurrent, maxQueueSize, workerCount)

	<-stopChan
	log.Println("Shutting down...")

	grpcServer.GracefulStop()
	httpServer.Shutdown(context.Background())

	log.Println("Shutdown complete")
}
