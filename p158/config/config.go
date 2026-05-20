package config

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig
	InfluxDB  InfluxDBConfig
	Dedupe    DedupeConfig
	Processor ProcessorConfig
	Map       MapConfig
}

type ServerConfig struct {
	Port string
}

type InfluxDBConfig struct {
	URL    string
	Token  string
	Org    string
	Bucket string
}

type DedupeConfig struct {
	WindowSize         time.Duration
	DuplicateInterval  time.Duration
	RandomMACThreshold int
}

type ProcessorConfig struct {
	StayDurationThreshold time.Duration
	HeatmapGridSize       float64
}

type MapConfig struct {
	CenterLat float64
	CenterLng float64
	Zoom      int
	APIKey    string
}

func Load() (*Config, error) {
	viper.SetDefault("SERVER_PORT", "8080")

	viper.SetDefault("INFLUXDB_URL", "http://localhost:8086")
	viper.SetDefault("INFLUXDB_TOKEN", "your-token-here")
	viper.SetDefault("INFLUXDB_ORG", "wifi-analytics")
	viper.SetDefault("INFLUXDB_BUCKET", "probe-data")

	viper.SetDefault("DEDUPE_WINDOW_SIZE", "5m")
	viper.SetDefault("DEDUPE_DUPLICATE_INTERVAL", "30s")
	viper.SetDefault("DEDUPE_RANDOM_MAC_THRESHOLD", 3)

	viper.SetDefault("PROCESSOR_STAY_THRESHOLD", "5m")
	viper.SetDefault("PROCESSOR_HEATMAP_GRID_SIZE", 0.0001)

	viper.SetDefault("MAP_CENTER_LAT", 39.9042)
	viper.SetDefault("MAP_CENTER_LNG", 116.4074)
	viper.SetDefault("MAP_ZOOM", 15)
	viper.SetDefault("MAP_API_KEY", "your-baidu-map-key")

	viper.AutomaticEnv()

	windowSize, _ := time.ParseDuration(viper.GetString("DEDUPE_WINDOW_SIZE"))
	dupInterval, _ := time.ParseDuration(viper.GetString("DEDUPE_DUPLICATE_INTERVAL"))
	stayThreshold, _ := time.ParseDuration(viper.GetString("PROCESSOR_STAY_THRESHOLD"))

	return &Config{
		Server: ServerConfig{
			Port: viper.GetString("SERVER_PORT"),
		},
		InfluxDB: InfluxDBConfig{
			URL:    viper.GetString("INFLUXDB_URL"),
			Token:  viper.GetString("INFLUXDB_TOKEN"),
			Org:    viper.GetString("INFLUXDB_ORG"),
			Bucket: viper.GetString("INFLUXDB_BUCKET"),
		},
		Dedupe: DedupeConfig{
			WindowSize:         windowSize,
			DuplicateInterval:  dupInterval,
			RandomMACThreshold: viper.GetInt("DEDUPE_RANDOM_MAC_THRESHOLD"),
		},
		Processor: ProcessorConfig{
			StayDurationThreshold: stayThreshold,
			HeatmapGridSize:       viper.GetFloat64("PROCESSOR_HEATMAP_GRID_SIZE"),
		},
		Map: MapConfig{
			CenterLat: viper.GetFloat64("MAP_CENTER_LAT"),
			CenterLng: viper.GetFloat64("MAP_CENTER_LNG"),
			Zoom:      viper.GetInt("MAP_ZOOM"),
			APIKey:    viper.GetString("MAP_API_KEY"),
		},
	}, nil
}
