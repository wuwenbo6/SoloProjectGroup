package main

import (
	"context"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

type RateLimitInterceptor struct {
	limiter       *AdaptiveRateLimiter
	diskQueue     *DiskQueue
	stats         *RequestStats
	maxConcurrent int32
	currentConns  int32
	maxQueueSize  int64
}

type RequestStats struct {
	TotalRequests    int64
	AcceptedRequests int64
	RejectedRequests int64
	QueuedRequests   int64
	ProcessedRequests int64
	TotalLatencyUs   int64
	Errors           int64
}

func NewRateLimitInterceptor(ratePerSecond int64, maxConcurrent int, maxQueueSize int64, dataDir string) (*RateLimitInterceptor, error) {
	limiter := NewAdaptiveRateLimiter(ratePerSecond, ratePerSecond*2, ratePerSecond/10)
	
	dq, err := NewDiskQueue(dataDir)
	if err != nil {
		return nil, err
	}

	return &RateLimitInterceptor{
		limiter:       limiter,
		diskQueue:     dq,
		stats:         &RequestStats{},
		maxConcurrent: int32(maxConcurrent),
		maxQueueSize:  maxQueueSize,
	}, nil
}

func (ri *RateLimitInterceptor) UnaryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		atomic.AddInt64(&ri.stats.TotalRequests, 1)

		current := atomic.LoadInt32(&ri.currentConns)
		if current >= ri.maxConcurrent {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return nil, status.Errorf(codes.ResourceExhausted, "too many concurrent connections: %d, max: %d", current, ri.maxConcurrent)
		}

		queueLen := ri.diskQueue.Len()
		if queueLen > ri.maxQueueSize {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return nil, status.Errorf(codes.ResourceExhausted, "queue overflow: %d, max: %d", queueLen, ri.maxQueueSize)
		}

		if !ri.limiter.TryAcquire(1) {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return nil, status.Errorf(codes.ResourceExhausted, "rate limit exceeded")
		}

		atomic.AddInt32(&ri.currentConns, 1)
		atomic.AddInt64(&ri.stats.AcceptedRequests, 1)

		start := time.Now()

		resp, err := handler(ctx, req)

		latency := time.Since(start).Microseconds()
		atomic.AddInt64(&ri.stats.TotalLatencyUs, latency)
		atomic.AddInt64(&ri.stats.ProcessedRequests, 1)
		atomic.AddInt32(&ri.currentConns, -1)

		if err != nil {
			atomic.AddInt64(&ri.stats.Errors, 1)
		}

		return resp, err
	}
}

func (ri *RateLimitInterceptor) StreamInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		atomic.AddInt64(&ri.stats.TotalRequests, 1)

		current := atomic.LoadInt32(&ri.currentConns)
		if current >= ri.maxConcurrent {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return status.Errorf(codes.ResourceExhausted, "too many concurrent connections: %d, max: %d", current, ri.maxConcurrent)
		}

		queueLen := ri.diskQueue.Len()
		if queueLen > ri.maxQueueSize {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return status.Errorf(codes.ResourceExhausted, "queue overflow: %d, max: %d", queueLen, ri.maxQueueSize)
		}

		if !ri.limiter.TryAcquire(1) {
			atomic.AddInt64(&ri.stats.RejectedRequests, 1)
			return status.Errorf(codes.ResourceExhausted, "rate limit exceeded")
		}

		atomic.AddInt32(&ri.currentConns, 1)
		atomic.AddInt64(&ri.stats.AcceptedRequests, 1)

		start := time.Now()

		err := handler(srv, ss)

		latency := time.Since(start).Microseconds()
		atomic.AddInt64(&ri.stats.TotalLatencyUs, latency)
		atomic.AddInt64(&ri.stats.ProcessedRequests, 1)
		atomic.AddInt32(&ri.currentConns, -1)

		if err != nil {
			atomic.AddInt64(&ri.stats.Errors, 1)
		}

		return err
	}
}

func (ri *RateLimitInterceptor) GetStats() map[string]interface{} {
	stats := make(map[string]interface{})

	stats["total_requests"] = atomic.LoadInt64(&ri.stats.TotalRequests)
	stats["accepted_requests"] = atomic.LoadInt64(&ri.stats.AcceptedRequests)
	stats["rejected_requests"] = atomic.LoadInt64(&ri.stats.RejectedRequests)
	stats["queued_requests"] = ri.diskQueue.Len()
	stats["processed_requests"] = atomic.LoadInt64(&ri.stats.ProcessedRequests)
	stats["errors"] = atomic.LoadInt64(&ri.stats.Errors)
	stats["current_concurrent"] = atomic.LoadInt32(&ri.currentConns)
	stats["max_concurrent"] = ri.maxConcurrent

	processed := atomic.LoadInt64(&ri.stats.ProcessedRequests)
	if processed > 0 {
		stats["avg_latency_us"] = atomic.LoadInt64(&ri.stats.TotalLatencyUs) / processed
	} else {
		stats["avg_latency_us"] = int64(0)
	}

	queueStats := ri.diskQueue.GetStats()
	for k, v := range queueStats {
		stats["queue_"+k] = v
	}

	limiterStats := ri.limiter.GetStats()
	for k, v := range limiterStats {
		stats["limiter_"+k] = v
	}

	return stats
}

func (ri *RateLimitInterceptor) Close() error {
	return ri.diskQueue.Close()
}

func (ri *RateLimitInterceptor) GetDiskQueue() *DiskQueue {
	return ri.diskQueue
}

func extractClientIP(ctx context.Context) string {
	p, ok := peer.FromContext(ctx)
	if !ok {
		return "unknown"
	}
	return p.Addr.String()
}

type BackpressureHandler struct {
	thresholdQueueSize int64
	thresholdLatency   time.Duration
	warningHandler     func()
	criticalHandler    func()
}

func NewBackpressureHandler(thresholdQueueSize int64, thresholdLatency time.Duration) *BackpressureHandler {
	return &BackpressureHandler{
		thresholdQueueSize: thresholdQueueSize,
		thresholdLatency:   thresholdLatency,
	}
}

func (bp *BackpressureHandler) Check(queueSize int64, avgLatency time.Duration) string {
	if queueSize > bp.thresholdQueueSize*2 || avgLatency > bp.thresholdLatency*2 {
		if bp.criticalHandler != nil {
			bp.criticalHandler()
		}
		return "critical"
	}
	if queueSize > bp.thresholdQueueSize || avgLatency > bp.thresholdLatency {
		if bp.warningHandler != nil {
			bp.warningHandler()
		}
		return "warning"
	}
	return "normal"
}

type CircuitBreaker struct {
	failureThreshold   int32
	successThreshold   int32
	timeout            time.Duration
	failures           int32
	successes          int32
	state              int32
	lastStateChange    time.Time
	mu                 *int32
}

const (
	StateClosed int32 = iota
	StateOpen
	StateHalfOpen
)

func NewCircuitBreaker(failureThreshold int, successThreshold int, timeout time.Duration) *CircuitBreaker {
	var mu int32 = 0
	return &CircuitBreaker{
		failureThreshold: int32(failureThreshold),
		successThreshold: int32(successThreshold),
		timeout:          timeout,
		state:            StateClosed,
		mu:               &mu,
	}
}

func (cb *CircuitBreaker) Allow() bool {
	currentState := atomic.LoadInt32(&cb.state)

	switch currentState {
	case StateOpen:
		if time.Since(cb.lastStateChange) > cb.timeout {
			if atomic.CompareAndSwapInt32(cb.mu, 0, 1) {
				if atomic.CompareAndSwapInt32(&cb.state, StateOpen, StateHalfOpen) {
					cb.lastStateChange = time.Now()
					atomic.StoreInt32(&cb.successes, 0)
				}
				atomic.CompareAndSwapInt32(cb.mu, 1, 0)
			}
		}
		return atomic.LoadInt32(&cb.state) != StateOpen
	case StateHalfOpen:
		return true
	default:
		return true
	}
}

func (cb *CircuitBreaker) OnSuccess() {
	currentState := atomic.LoadInt32(&cb.state)

	if currentState == StateHalfOpen {
		newSuccesses := atomic.AddInt32(&cb.successes, 1)
		if newSuccesses >= cb.successThreshold {
			if atomic.CompareAndSwapInt32(cb.mu, 0, 1) {
				if atomic.CompareAndSwapInt32(&cb.state, StateHalfOpen, StateClosed) {
					cb.lastStateChange = time.Now()
					atomic.StoreInt32(&cb.failures, 0)
				}
				atomic.CompareAndSwapInt32(cb.mu, 1, 0)
			}
		}
	}
}

func (cb *CircuitBreaker) OnFailure() {
	currentState := atomic.LoadInt32(&cb.state)

	switch currentState {
	case StateClosed:
		newFailures := atomic.AddInt32(&cb.failures, 1)
		if newFailures >= cb.failureThreshold {
			if atomic.CompareAndSwapInt32(cb.mu, 0, 1) {
				if atomic.CompareAndSwapInt32(&cb.state, StateClosed, StateOpen) {
					cb.lastStateChange = time.Now()
				}
				atomic.CompareAndSwapInt32(cb.mu, 1, 0)
			}
		}
	case StateHalfOpen:
		if atomic.CompareAndSwapInt32(cb.mu, 0, 1) {
			if atomic.CompareAndSwapInt32(&cb.state, StateHalfOpen, StateOpen) {
				cb.lastStateChange = time.Now()
			}
			atomic.CompareAndSwapInt32(cb.mu, 1, 0)
		}
	}
}

func (cb *CircuitBreaker) GetState() string {
	switch atomic.LoadInt32(&cb.state) {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}
