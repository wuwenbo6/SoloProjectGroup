package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type TokenBucket struct {
	capacity       int64
	tokens         int64
	rate           int64
	lastRefillTime time.Time
	mu             sync.Mutex
	metrics        *RateLimitMetrics
}

type RateLimitMetrics struct {
	TotalRequests   int64
	AllowedRequests int64
	RejectedRequests int64
	TotalWaitTime   time.Duration
	mu              sync.Mutex
}

func NewTokenBucket(ratePerSecond int64, capacity int64) *TokenBucket {
	if capacity <= 0 {
		capacity = ratePerSecond
	}
	return &TokenBucket{
		capacity:       capacity,
		tokens:         capacity,
		rate:           ratePerSecond,
		lastRefillTime: time.Now(),
		metrics:        &RateLimitMetrics{},
	}
}

func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefillTime)
	if elapsed <= 0 {
		return
	}

	newTokens := int64(elapsed.Seconds() * float64(tb.rate))
	if newTokens > 0 {
		tb.tokens = min(tb.capacity, tb.tokens + newTokens)
		tb.lastRefillTime = now
	}
}

func (tb *TokenBucket) TryAcquire(tokens int64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	tb.metrics.TotalRequests++
	tb.refill()

	if tb.tokens >= tokens {
		tb.tokens -= tokens
		tb.metrics.AllowedRequests++
		return true
	}

	tb.metrics.RejectedRequests++
	return false
}

func (tb *TokenBucket) Acquire(ctx context.Context, tokens int64) error {
	for {
		tb.mu.Lock()
		tb.refill()

		if tb.tokens >= tokens {
			tb.tokens -= tokens
			tb.mu.Unlock()
			tb.metrics.AllowedRequests++
			return nil
		}

		needed := tokens - tb.tokens
		waitTime := time.Duration(float64(needed) / float64(tb.rate) * float64(time.Second))
		waitTime = max(waitTime, 100*time.Microsecond)
		waitTime = min(waitTime, 100*time.Millisecond)
		tb.mu.Unlock()

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(waitTime):
			tb.metrics.mu.Lock()
			tb.metrics.TotalWaitTime += waitTime
			tb.metrics.mu.Unlock()
		}
	}
}

func (tb *TokenBucket) GetMetrics() RateLimitMetrics {
	tb.metrics.mu.Lock()
	defer tb.metrics.mu.Unlock()
	return *tb.metrics
}

func (tb *TokenBucket) GetStats() map[string]interface{} {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	metrics := tb.GetMetrics()
	return map[string]interface{}{
		"rate":            tb.rate,
		"capacity":        tb.capacity,
		"current_tokens":  tb.tokens,
		"total_requests":  metrics.TotalRequests,
		"allowed":         metrics.AllowedRequests,
		"rejected":        metrics.RejectedRequests,
		"reject_rate":     float64(metrics.RejectedRequests) / float64(max(1, metrics.TotalRequests)) * 100,
		"avg_wait_us":     metrics.TotalWaitTime.Microseconds() / max(1, metrics.AllowedRequests),
	}
}

func (tb *TokenBucket) SetRate(newRate int64) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.rate = newRate
}

func (tb *TokenBucket) SetCapacity(newCapacity int64) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.capacity = newCapacity
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
}

type MultiLevelRateLimiter struct {
	globalLimiter *TokenBucket
	ipLimiters    map[string]*TokenBucket
	maxIPLimiters int
	perIPRate     int64
	mu            sync.RWMutex
}

func NewMultiLevelRateLimiter(globalRate int64, perIPRate int64, maxIPs int) *MultiLevelRateLimiter {
	return &MultiLevelRateLimiter{
		globalLimiter: NewTokenBucket(globalRate, globalRate*2),
		ipLimiters:    make(map[string]*TokenBucket),
		maxIPLimiters: maxIPs,
		perIPRate:     perIPRate,
	}
}

func (ml *MultiLevelRateLimiter) getIPLimiter(ip string) *TokenBucket {
	ml.mu.RLock()
	limiter, exists := ml.ipLimiters[ip]
	ml.mu.RUnlock()

	if exists {
		return limiter
	}

	ml.mu.Lock()
	defer ml.mu.Unlock()

	limiter, exists = ml.ipLimiters[ip]
	if exists {
		return limiter
	}

	if len(ml.ipLimiters) >= ml.maxIPLimiters {
		for k := range ml.ipLimiters {
			delete(ml.ipLimiters, k)
			break
		}
	}

	limiter = NewTokenBucket(ml.perIPRate, ml.perIPRate*2)
	ml.ipLimiters[ip] = limiter
	return limiter
}

func (ml *MultiLevelRateLimiter) TryAcquire(ctx context.Context, ip string, tokens int64) bool {
	if !ml.globalLimiter.TryAcquire(tokens) {
		return false
	}

	ipLimiter := ml.getIPLimiter(ip)
	if !ipLimiter.TryAcquire(tokens) {
		return false
	}

	return true
}

func (ml *MultiLevelRateLimiter) Acquire(ctx context.Context, ip string, tokens int64) error {
	if err := ml.globalLimiter.Acquire(ctx, tokens); err != nil {
		return err
	}

	ipLimiter := ml.getIPLimiter(ip)
	return ipLimiter.Acquire(ctx, tokens)
}

func (ml *MultiLevelRateLimiter) GetStats() map[string]interface{} {
	ml.mu.RLock()
	ipCount := len(ml.ipLimiters)
	ml.mu.RUnlock()

	globalStats := ml.globalLimiter.GetStats()
	globalStats["ip_limiter_count"] = ipCount
	return globalStats
}

type AdaptiveRateLimiter struct {
	limiter         *TokenBucket
	baseRate        int64
	maxRate         int64
	minRate         int64
	windowSize      time.Duration
	lastAdjustTime  time.Time
	errorRate       float64
	latencyP99     time.Duration
	mu             sync.Mutex
}

func NewAdaptiveRateLimiter(baseRate int64, maxRate int64, minRate int64) *AdaptiveRateLimiter {
	return &AdaptiveRateLimiter{
		limiter:        NewTokenBucket(baseRate, baseRate*2),
		baseRate:       baseRate,
		maxRate:        maxRate,
		minRate:        minRate,
		windowSize:     10 * time.Second,
		lastAdjustTime: time.Now(),
	}
}

func (al *AdaptiveRateLimiter) TryAcquire(tokens int64) bool {
	return al.limiter.TryAcquire(tokens)
}

func (al *AdaptiveRateLimiter) Acquire(ctx context.Context, tokens int64) error {
	return al.limiter.Acquire(ctx, tokens)
}

func (al *AdaptiveRateLimiter) AdjustRate(errorRate float64, latencyP99 time.Duration) {
	al.mu.Lock()
	defer al.mu.Unlock()

	now := time.Now()
	if now.Sub(al.lastAdjustTime) < al.windowSize {
		return
	}

	al.errorRate = errorRate
	al.latencyP99 = latencyP99

	currentRate := al.limiter.rate

	if errorRate > 0.1 || latencyP99 > 500*time.Millisecond {
		newRate := max(al.minRate, int64(float64(currentRate)*0.8))
		if newRate != currentRate {
			al.limiter.SetRate(newRate)
		}
	} else if errorRate < 0.01 && latencyP99 < 100*time.Millisecond {
		newRate := min(al.maxRate, int64(float64(currentRate)*1.1))
		if newRate != currentRate {
			al.limiter.SetRate(newRate)
		}
	}

	al.lastAdjustTime = now
}

func (al *AdaptiveRateLimiter) GetStats() map[string]interface{} {
	al.mu.Lock()
	defer al.mu.Unlock()

	stats := al.limiter.GetStats()
	stats["error_rate"] = al.errorRate
	stats["latency_p99_ms"] = al.latencyP99.Milliseconds()
	return stats
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func maxDuration(a, b time.Duration) time.Duration {
	if a > b {
		return a
	}
	return b
}

func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
