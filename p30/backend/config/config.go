package config

import (
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Sync     SyncConfig
	Model    ModelConfig
}

type ServerConfig struct {
	Port         int
	ReadTimeout  int
	WriteTimeout int
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type SyncConfig struct {
	BatchSize     int
	RetentionDays int
}

type ModelConfig struct {
	ModelDir      string
	UpdateCheck   int
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvInt("SERVER_READ_TIMEOUT", 30),
			WriteTimeout: getEnvInt("SERVER_WRITE_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Host:     getEnvStr("DB_HOST", "localhost"),
			Port:     getEnvInt("DB_PORT", 5432),
			User:     getEnvStr("DB_USER", "pestuser"),
			Password: getEnvStr("DB_PASSWORD", "pestpass"),
			DBName:   getEnvStr("DB_NAME", "pestmonitor"),
			SSLMode:  getEnvStr("DB_SSLMODE", "disable"),
		},
		Sync: SyncConfig{
			BatchSize:     1000,
			RetentionDays: 90,
		},
		Model: ModelConfig{
			ModelDir:    "models",
			UpdateCheck: 3600,
		},
	}
}

func getEnvStr(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}
