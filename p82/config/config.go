package config

import (
	"os"
)

type DatabaseConfig struct {
	FiringDSN     string
	KilnTempDSN   string
	ProcessDSN    string
	AuthDSN       string
}

type ServerConfig struct {
	Port           string
	JWTSecret      string
	ThirdPartyAPI  string
	ThirdPartyKey  string
}

func LoadDatabaseConfig() *DatabaseConfig {
	return &DatabaseConfig{
		FiringDSN:     getEnv("FIRING_DB_DSN", "root:password@tcp(127.0.0.1:3306)/ceramic_firing?charset=utf8mb4&parseTime=True&loc=Local"),
		KilnTempDSN:   getEnv("KILN_TEMP_DB_DSN", "root:password@tcp(127.0.0.1:3306)/ceramic_kiln_temp?charset=utf8mb4&parseTime=True&loc=Local"),
		ProcessDSN:    getEnv("PROCESS_DB_DSN", "root:password@tcp(127.0.0.1:3306)/ceramic_process?charset=utf8mb4&parseTime=True&loc=Local"),
		AuthDSN:       getEnv("AUTH_DB_DSN", "root:password@tcp(127.0.0.1:3306)/ceramic_auth?charset=utf8mb4&parseTime=True&loc=Local"),
	}
}

func LoadServerConfig() *ServerConfig {
	return &ServerConfig{
		Port:          getEnv("SERVER_PORT", "8080"),
		JWTSecret:     getEnv("JWT_SECRET", "ceramic-secret-key-2024"),
		ThirdPartyAPI: getEnv("THIRD_PARTY_API", "https://api.test-lab.com/v1"),
		ThirdPartyKey: getEnv("THIRD_PARTY_KEY", "test-api-key"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
