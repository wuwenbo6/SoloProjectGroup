package main

import (
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"iot-core-service/internal/api"
	"iot-core-service/internal/service"
	"iot-core-service/internal/storage"
	"iot-core-service/pkg/config"
)

const (
	defaultJWTSecret = "your-super-secret-jwt-key-change-in-production"
	defaultRetentionDays = 30
)

func main() {
	logger := initLogger()
	defer logger.Sync()

	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "../configs/config.yaml"
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		logger.Fatal("Failed to load config", zap.Error(err))
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = defaultJWTSecret
		logger.Warn("Using default JWT secret, change in production")
	}

	influxDB, err := storage.NewInfluxDBStorage(&cfg.InfluxDB, logger)
	if err != nil {
		logger.Fatal("Failed to connect to InfluxDB", zap.Error(err))
	}
	defer influxDB.Close()

	postgres, err := storage.NewPostgreSQLStorage(&cfg.PostgreSQL, logger)
	if err != nil {
		logger.Fatal("Failed to connect to PostgreSQL", zap.Error(err))
	}
	defer postgres.Close()

	anomalyCli, err := service.NewAnomalyDetectionClient(&cfg.AnomalyDetection, logger)
	if err != nil {
		logger.Warn("Failed to connect to anomaly detection service, continuing without it", zap.Error(err))
	}
	if anomalyCli != nil {
		defer anomalyCli.Close()
	}

	authService := service.NewAuthService(jwtSecret, logger)
	webhookService := service.NewWebhookService(logger)
	anomalyRuleService := service.NewAnomalyRuleService(logger)

	downsampler := service.NewDownsamplerService(
		influxDB.GetClient(),
		cfg.InfluxDB.Org,
		defaultRetentionDays,
		logger,
	)
	downsampler.Start()
	defer downsampler.Stop()

	backupService := service.NewBackupService(
		influxDB.GetClient(),
		cfg.InfluxDB.Org,
		cfg.InfluxDB.Bucket,
		logger,
	)
	backupService.StartScheduledBackup()
	defer backupService.Stop()

	var grpcConnForHealth *api.GRPCConnectionPool
	if anomalyCli != nil {
		grpcConnForHealth = anomalyCli.GetPool()
	}

	healthCheckService := service.NewHealthCheckService(
		logger,
		influxDB.GetClient(),
		postgres.GetDB(),
		nil,
	)

	dataService := service.NewDataService(influxDB, postgres, anomalyCli, webhookService, logger)

	httpServer := api.NewHTTPServerWithInfluxDB(cfg, dataService, authService, webhookService, anomalyRuleService, backupService, healthCheckService, influxDB, logger)
	if err := httpServer.Start(); err != nil {
		logger.Fatal("Failed to start HTTP server", zap.Error(err))
	}

	grpcServer := api.NewGRPCServer(cfg, dataService, logger)
	if err := grpcServer.Start(); err != nil {
		logger.Fatal("Failed to start gRPC server", zap.Error(err))
	}

	logger.Info("Creating default admin token for testing - use this to generate user tokens")
	adminToken, _, _ := authService.GenerateToken("admin", "admin", []string{"admin"}, []string{"*"})
	logger.Info("Admin Bearer token", zap.String("token", adminToken))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down servers...")

	if err := httpServer.Stop(); err != nil {
		logger.Error("Failed to stop HTTP server", zap.Error(err))
	}

	grpcServer.Stop()

	logger.Info("Servers stopped successfully")
}

func initLogger() *zap.Logger {
	config := zap.NewProductionConfig()
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	config.EncoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder

	logger, err := config.Build()
	if err != nil {
		panic("failed to initialize logger: " + err.Error())
	}

	return logger
}
