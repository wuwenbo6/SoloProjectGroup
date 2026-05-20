package main

import (
	"context"
	"sync"
	"testing"
	"time"

	pb "github.com/tracetrace/proto"
	"google.golang.org/grpc"
)

func TestTokenBucket(t *testing.T) {
	tb := NewTokenBucket(100, 100)

	t.Run("Acquire tokens", func(t *testing.T) {
		ctx := context.Background()
		for i := 0; i < 50; i++ {
			if !tb.TryAcquire(1) {
				t.Errorf("Expected to acquire token %d", i)
			}
		}
	})

	t.Run("Acquire with context", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		err := tb.Acquire(ctx, 1)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
}

func TestRateLimitInterceptor(t *testing.T) {
	limiter, err := NewRateLimitInterceptor(100, 10, 1000, "/tmp/test-queue")
	if err != nil {
		t.Fatalf("Failed to create limiter: %v", err)
	}
	defer limiter.Close()

	t.Run("Unary intercept", func(t *testing.T) {
		interceptor := limiter.UnaryInterceptor()
		req := &pb.ExportTraceServiceRequest{
			Spans: make([]*pb.Span, 10),
		}

		handler := func(ctx context.Context, req interface{}) (interface{}, error) {
			return &pb.ExportTraceServiceResponse{Success: true}, nil
		}

		resp, err := interceptor(context.Background(), req, &grpc.UnaryServerInfo{}, handler)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}

		if _, ok := resp.(*pb.ExportTraceServiceResponse); !ok {
			t.Errorf("Expected response to be ExportTraceServiceResponse")
		}
	})
}

func TestAdaptiveRateLimiter(t *testing.T) {
	limiter := NewAdaptiveRateLimiter(100, 100)

	t.Run("Adjust rate on error", func(t *testing.T) {
		initialRate := limiter.currentRate

		for i := 0; i < 5; i++ {
			limiter.RecordError()
		}

		time.Sleep(200 * time.Millisecond)

		if limiter.currentRate >= initialRate {
			t.Errorf("Expected rate to decrease, got %d (was %d)", limiter.currentRate, initialRate)
		}
	})
}

func TestDiskQueue(t *testing.T) {
	dir := t.TempDir()

	t.Run("Push and Pop", func(t *testing.T) {
		q, err := NewDiskQueue(dir)
		if err != nil {
			t.Fatalf("Failed to create queue: %v", err)
		}
		defer q.Close()

		testData := [][]byte{
			[]byte("test1"),
			[]byte("test2"),
			[]byte("test3"),
		}

		for _, d := range testData {
			if err := q.Push(d); err != nil {
				t.Errorf("Failed to push: %v", err)
			}
		}

		stats := q.GetStats()
		if stats.Depth != int64(len(testData)) {
			t.Errorf("Expected depth %d, got %d", len(testData), stats.Depth)
		}

		for i, expected := range testData {
			data, err := q.Pop()
			if err != nil {
				t.Errorf("Failed to pop: %v", err)
			}
			if string(data) != string(expected) {
				t.Errorf("Item %d: expected %q, got %q", i, expected, data)
			}
		}
	})

	t.Run("Concurrent push", func(t *testing.T) {
		q, err := NewDiskQueue(dir + "/concurrent")
		if err != nil {
			t.Fatalf("Failed to create queue: %v", err)
		}
		defer q.Close()

		var wg sync.WaitGroup
		numWorkers := 10
		numPerWorker := 100

		for i := 0; i < numWorkers; i++ {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				for j := 0; j < numPerWorker; j++ {
					data := []byte(fmt.Sprintf("worker-%d-item-%d", idx, j))
					if err := q.Push(data); err != nil {
						t.Logf("Push error: %v", err)
					}
				}
			}(i)
		}

		wg.Wait()

		stats := q.GetStats()
		expected := int64(numWorkers * numPerWorker)
		if stats.Depth != expected {
			t.Errorf("Expected depth %d, got %d", expected, stats.Depth)
		}
	})
}
