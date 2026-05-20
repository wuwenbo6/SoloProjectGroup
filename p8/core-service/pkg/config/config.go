package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Server          ServerConfig          `mapstructure:"server"`
	InfluxDB        InfluxDBConfig        `mapstructure:"influxdb"`
	PostgreSQL      PostgreSQLConfig      `mapstructure:"postgresql"`
	AnomalyDetection AnomalyDetectionConfig `mapstructure:"anomaly_detection"`
	Prometheus      PrometheusConfig      `mapstructure:"prometheus"`
	Log             LogConfig             `mapstructure:"log"`
}

type ServerConfig struct {
	HTTPPort int `mapstructure:"http_port"`
	GRPCPort int `mapstructure:"grpc_port"`
}

type InfluxDBConfig struct {
	URL    string `mapstructure:"url"`
	Token  string `mapstructure:"token"`
	Org    string `mapstructure:"org"`
	Bucket string `mapstructure:"bucket"`
}

type PostgreSQLConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
}

type AnomalyDetectionConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

type PrometheusConfig struct {
	Port int `mapstructure:"port"`
}

type LogConfig struct {
	Level string `mapstructure:"level"`
}

func Load(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}
