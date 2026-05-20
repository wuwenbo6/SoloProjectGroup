package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/time/rate"

	"iot-core-service/internal/service"
)

func AuthMiddleware(authService *service.AuthService, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header is required"})
			c.Abort()
			return
		}

		tokenString := authService.ExtractTokenFromHeader(authHeader)
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			logger.Warn("Invalid token", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		c.Request = c.Request.WithContext(authService.ContextWithUser(c.Request.Context(), claims))
		c.Next()
	}
}

func DeviceAccessMiddleware(authService *service.AuthService, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("device_id")
		if deviceID == "" {
			deviceID = c.Query("device_id")
		}

		if deviceID == "" {
			c.Next()
			return
		}

		claims, exists := authService.UserFromContext(c.Request.Context())
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
			c.Abort()
			return
		}

		if !authService.CanAccessDevice(claims, deviceID) {
			logger.Warn("Device access denied",
				zap.String("user_id", claims.UserID),
				zap.String("device_id", deviceID))
			c.JSON(http.StatusForbidden, gin.H{"error": "access to device denied"})
			c.Abort()
			return
		}

		c.Next()
	}
}

type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       chan struct{}
	rate     rate.Limit
	burst    int
	logger   *zap.Logger
}

func NewRateLimiter(r rate.Limit, burst int, logger *zap.Logger) *RateLimiter {
	return &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		mu:       make(chan struct{}, 1),
		rate:     r,
		burst:    burst,
		logger:   logger,
	}
}

func (rl *RateLimiter) GetLimiter(key string) *rate.Limiter {
	rl.mu <- struct{}{}
	defer func() { <-rl.mu }()

	limiter, exists := rl.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[key] = limiter
	}

	return limiter
}

func (rl *RateLimiter) CleanupStale() {
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			rl.mu <- struct{}{}
			for key := range rl.limiters {
				delete(rl.limiters, key)
			}
			rl.mu <- struct{}{}
			rl.logger.Debug("Cleaned up stale rate limiters")
		}
	}()
}

func RateLimitMiddleware(limiter *RateLimiter, authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := getRateLimitKey(c, authService)
		l := limiter.GetLimiter(key)

		if !l.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests",
				"retry_after": "60s",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func getRateLimitKey(c *gin.Context, authService *service.AuthService) string {
	claims, exists := authService.UserFromContext(c.Request.Context())
	if exists {
		return "user:" + claims.UserID
	}

	ip := c.ClientIP()
	if ip == "" {
		ip = c.RemoteIP()
	}
	return "ip:" + ip
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func BodyLimitMiddleware(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

func RequestLoggerMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()

		logger.Info("HTTP Request",
			zap.Int("status", statusCode),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.String("ip", c.ClientIP()),
			zap.String("user-agent", c.Request.UserAgent()),
			zap.Duration("latency", latency),
		)
	}
}

func AdminRequiredMiddleware(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, exists := authService.UserFromContext(c.Request.Context())
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
			c.Abort()
			return
		}

		isAdmin := false
		for _, role := range claims.Roles {
			if role == "admin" || role == "superuser" {
				isAdmin = true
				break
			}
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "admin role required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
