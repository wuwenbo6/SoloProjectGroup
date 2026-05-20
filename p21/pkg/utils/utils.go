package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"
)

func GenerateTaskID() string {
	return fmt.Sprintf("task_%s_%d", generateRandomString(8), time.Now().UnixNano())
}

func GenerateWorkerID() string {
	hostname, _ := os.Hostname()
	pid := os.Getpid()
	return fmt.Sprintf("worker_%s_%d_%s", hostname, pid, generateRandomString(6))
}

func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

func HashSequence(sequence string) string {
	h := sha256.New()
	h.Write([]byte(sequence))
	return hex.EncodeToString(h.Sum(nil))
}

func ToJSON(v interface{}) string {
	data, _ := json.Marshal(v)
	return string(data)
}

func FromJSON(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}

func GetEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func GetEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func EnsureDir(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return os.MkdirAll(path, 0755)
	}
	return nil
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
