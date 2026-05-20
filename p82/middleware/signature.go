package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	HeaderTimestamp     = "X-Timestamp"
	HeaderNonce         = "X-Nonce"
	HeaderSignature     = "X-Signature"
	HeaderAppKey        = "X-App-Key"
	HeaderSignedHeaders = "X-Signed-Headers"
	MaxTimestampDelta   = 300
	NonceCacheSize      = 10000
)

type NonceCache struct {
	nonces map[string]int64
	mu     sync.RWMutex
}

var globalNonceCache = &NonceCache{
	nonces: make(map[string]int64),
}

type SecurityConfig struct {
	AppKey        string
	SecretKey     string
	Algorithm     string
	ExpireSeconds int
	IsActive      bool
}

var securityConfigs = make(map[string]*SecurityConfig)

func InitSecurityConfig(configs []*SecurityConfig) {
	for _, cfg := range configs {
		securityConfigs[cfg.AppKey] = cfg
	}
	go cleanupNonceCache()
}

func cleanupNonceCache() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		now := time.Now().Unix()
		globalNonceCache.mu.Lock()
		for nonce, ts := range globalNonceCache.nonces {
			if now-ts > MaxTimestampDelta {
				delete(globalNonceCache.nonces, nonce)
			}
		}
		globalNonceCache.mu.Unlock()
	}
}

func SignatureAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		appKey := c.GetHeader(HeaderAppKey)
		if appKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "App Key is required"})
			c.Abort()
			return
		}

		config, ok := securityConfigs[appKey]
		if !ok || !config.IsActive {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or inactive App Key"})
			c.Abort()
			return
		}

		timestamp := c.GetHeader(HeaderTimestamp)
		nonce := c.GetHeader(HeaderNonce)
		signature := c.GetHeader(HeaderSignature)
		signedHeaders := c.GetHeader(HeaderSignedHeaders)

		if timestamp == "" || nonce == "" || signature == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing required signature headers"})
			c.Abort()
			return
		}

		ts, err := strconv.ParseInt(timestamp, 10, 64)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid timestamp format"})
			c.Abort()
			return
		}

		now := time.Now().Unix()
		if now-ts > int64(config.ExpireSeconds) || ts-now > 60 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Request expired"})
			c.Abort()
			return
		}

		globalNonceCache.mu.RLock()
		if _, exists := globalNonceCache.nonces[nonce]; exists {
			globalNonceCache.mu.RUnlock()
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Duplicate request"})
			c.Abort()
			return
		}
		globalNonceCache.mu.RUnlock()

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read request body"})
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

		expectedSignature := generateSignature(c, appKey, timestamp, nonce, string(body), signedHeaders, config.SecretKey)

		if !hmacEqual(signature, expectedSignature) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
			c.Abort()
			return
		}

		globalNonceCache.mu.Lock()
		if len(globalNonceCache.nonces) >= NonceCacheSize {
			for k := range globalNonceCache.nonces {
				delete(globalNonceCache.nonces, k)
				break
			}
		}
		globalNonceCache.nonces[nonce] = ts
		globalNonceCache.mu.Unlock()

		c.Set("app_key", appKey)
		c.Next()
	}
}

func generateSignature(c *gin.Context, appKey, timestamp, nonce, body, signedHeaders, secretKey string) string {
	var headersToSign []string
	if signedHeaders != "" {
		headersToSign = strings.Split(signedHeaders, ";")
	}

	headerValues := make(map[string]string)
	for _, h := range headersToSign {
		headerValues[h] = c.GetHeader(h)
	}

	sortedHeaders := make([]string, 0, len(headerValues))
	for k := range headerValues {
		sortedHeaders = append(sortedHeaders, k)
	}
	sort.Strings(sortedHeaders)

	var headerString strings.Builder
	for _, k := range sortedHeaders {
		headerString.WriteString(k)
		headerString.WriteString(":")
		headerString.WriteString(headerValues[k])
		headerString.WriteString("\n")
	}

	bodyHash := sha256Hash(body)

	method := c.Request.Method
	path := c.Request.URL.Path
	query := c.Request.URL.RawQuery

	signingString := strings.Join([]string{
		method,
		path,
		query,
		appKey,
		timestamp,
		nonce,
		headerString.String(),
		bodyHash,
	}, "\n")

	return hmacSha256(signingString, secretKey)
}

func sha256Hash(data string) string {
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func hmacSha256(data, key string) string {
	h := hmac.New(sha256.New, []byte(key))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

func hmacEqual(a, b string) bool {
	return hmac.Equal([]byte(a), []byte(b))
}

func EncryptResponse() gin.HandlerFunc {
	return func(c *gin.Context) {
		appKey, exists := c.Get("app_key")
		if !exists {
			c.Next()
			return
		}

		config, ok := securityConfigs[appKey.(string)]
		if !ok {
			c.Next()
			return
		}

		wb := &responseBodyWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = wb

		c.Next()

		if c.Writer.Status() >= http.StatusOK && c.Writer.Status() < http.StatusMultipleChoices {
			encrypted := encryptData(wb.body.String(), config.SecretKey)
			c.Header("X-Response-Encrypted", "true")
			c.Header("Content-Type", "application/json")
			wb.ResponseWriter.Write([]byte(`{"data":"` + encrypted + `"}`))
		}
	}
}

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (r *responseBodyWriter) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func encryptData(data, key string) string {
	return hmacSha256(data, key)
}

func GenerateSignatureHeaders(appKey, secretKey, method, path, query string, body interface{}) map[string]string {
	now := time.Now().Unix()
	nonce := strconv.FormatInt(now, 10) + "-" + strconv.FormatInt(int64(time.Now().Nanosecond()), 10)

	bodyStr := ""
	if body != nil {
		jsonData, _ := json.Marshal(body)
		bodyStr = string(jsonData)
	}

	headers := map[string]string{
		HeaderAppKey:    appKey,
		HeaderTimestamp: strconv.FormatInt(now, 10),
		HeaderNonce:     nonce,
	}

	signedHeaders := ""
	signature := generateSignatureFromParams(appKey, strconv.FormatInt(now, 10), nonce, method, path, query, bodyStr, signedHeaders, secretKey)
	headers[HeaderSignature] = signature

	return headers
}

func generateSignatureFromParams(appKey, timestamp, nonce, method, path, query, body, signedHeaders, secretKey string) string {
	bodyHash := sha256Hash(body)

	signingString := strings.Join([]string{
		method,
		path,
		query,
		appKey,
		timestamp,
		nonce,
		"",
		bodyHash,
	}, "\n")

	return hmacSha256(signingString, secretKey)
}

func GetSecurityConfig(c *gin.Context) {
	var configs []map[string]interface{}
	for _, cfg := range securityConfigs {
		configs = append(configs, map[string]interface{}{
			"app_key":       cfg.AppKey,
			"algorithm":     cfg.Algorithm,
			"expire_seconds": cfg.ExpireSeconds,
			"is_active":      cfg.IsActive,
		})
	}
	c.JSON(http.StatusOK, gin.H{"configs": configs})
}
