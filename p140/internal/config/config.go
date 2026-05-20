package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

type Config struct {
	ServerPort string

	PostgresHost     string
	PostgresPort     string
	PostgresUser     string
	PostgresPassword string
	PostgresDB       string

	RedisHost     string
	RedisPort     string
	RedisPassword string

	RabbitMQURL string

	MinIOEndpoint   string
	MinIOAccessKey  string
	MinIOSecretKey  string
	MinIOUseSSL     bool
	MinIOInputBucket  string
	MinIOOutputBucket string
	MinIOSegmentsBucket string

	FFmpegPath     string
	SegmentDuration int
	WorkerCount    int
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		logrus.Warn("No .env file found")
	}

	segmentDuration, _ := strconv.Atoi(getEnv("SEGMENT_DURATION", "10"))
	workerCount, _ := strconv.Atoi(getEnv("WORKER_COUNT", "3"))
	useSSL, _ := strconv.ParseBool(getEnv("MINIO_USE_SSL", "false"))

	return &Config{
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		PostgresHost:   getEnv("POSTGRES_HOST", "localhost"),
		PostgresPort:   getEnv("POSTGRES_PORT", "5432"),
		PostgresUser:   getEnv("POSTGRES_USER", "transcoder"),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", "transcoder123"),
		PostgresDB:     getEnv("POSTGRES_DB", "transcoder"),
		RedisHost:      getEnv("REDIS_HOST", "localhost"),
		RedisPort:      getEnv("REDIS_PORT", "6379"),
		RedisPassword:  getEnv("REDIS_PASSWORD", ""),
		RabbitMQURL:    getEnv("RABBITMQ_URL", "amqp://admin:admin123@localhost:5672/"),
		MinIOEndpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin123"),
		MinIOUseSSL:    useSSL,
		MinIOInputBucket:  getEnv("MINIO_INPUT_BUCKET", "input-videos"),
		MinIOOutputBucket: getEnv("MINIO_OUTPUT_BUCKET", "output-videos"),
		MinIOSegmentsBucket: getEnv("MINIO_SEGMENTS_BUCKET", "video-segments"),
		FFmpegPath:     getEnv("FFMPEG_PATH", "ffmpeg"),
		SegmentDuration: segmentDuration,
		WorkerCount:    workerCount,
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
