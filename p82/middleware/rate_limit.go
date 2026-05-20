package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type IPRateLimiter struct {
	ips map[string]*rateLimiter
	mu  sync.RWMutex
}

type rateLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var globalRateLimiter = &IPRateLimiter{
	ips: make(map[string]*rateLimiter),
}

func (rl *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.ips[ip]
	if !exists {
		limiter = &rateLimiter{
			limiter:  rate.NewLimiter(rate.Limit(100), 500),
			lastSeen: time.Now(),
		}
		rl.ips[ip] = limiter
		return limiter.limiter
	}

	limiter.lastSeen = time.Now()
	return limiter.limiter
}

func (rl *IPRateLimiter) cleanupOldEntries() {
	for {
		time.Sleep(5 * time.Minute)
		rl.mu.Lock()
		for ip, limiter := range rl.ips {
			if time.Since(limiter.lastSeen) > 10*time.Minute {
				delete(rl.ips, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func RateLimitMiddleware() gin.HandlerFunc {
	go globalRateLimiter.cleanupOldEntries()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := globalRateLimiter.getLimiter(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
				"code":  429,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		done := make(chan struct{})
		go func() {
			c.Next()
			close(done)
		}()

		select {
		case <-done:
			return
		case <-ctx.Done():
			c.JSON(http.StatusGatewayTimeout, gin.H{
				"error": "Request timeout",
				"code":  504,
			})
			c.Abort()
			return
		}
	}
}

var concurrentRequests = make(chan struct{}, 500)

func ConcurrencyLimiter() gin.HandlerFunc {
	return func(c *gin.Context) {
		select {
		case concurrentRequests <- struct{}{}:
			defer func() {
				<-concurrentRequests
			}()
			c.Next()
		default:
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "Service is busy, please try again later",
				"code":  503,
			})
			c.Abort()
			return
		}
	}
}

type RequestMetrics struct {
	TotalRequests    int64
	ActiveRequests   int32
	ErrorCount       int64
	ResponseTimeSum  int64
	mu               sync.RWMutex
}

var globalMetrics = &RequestMetrics{}

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		globalMetrics.mu.Lock()
		globalMetrics.TotalRequests++
		globalMetrics.ActiveRequests++
		globalMetrics.mu.Unlock()

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		globalMetrics.mu.Lock()
		globalMetrics.ActiveRequests--
		globalMetrics.ResponseTimeSum += duration.Milliseconds()
		if status >= 500 {
			globalMetrics.ErrorCount++
		}
		globalMetrics.mu.Unlock()
	}
}

func GetMetrics() map[string]interface{} {
	globalMetrics.mu.RLock()
	defer globalMetrics.mu.RUnlock()

	avgResponseTime := int64(0)
	if globalMetrics.TotalRequests > 0 {
		avgResponseTime = globalMetrics.ResponseTimeSum / globalMetrics.TotalRequests
	}

	return map[string]interface{}{
		"total_requests":     globalMetrics.TotalRequests,
		"active_requests":    globalMetrics.ActiveRequests,
		"error_count":        globalMetrics.ErrorCount,
		"avg_response_time":  avgResponseTime,
		"concurrency_limit":  cap(concurrentRequests),
		"current_concurrency":len(concurrentRequests),
	}
}
