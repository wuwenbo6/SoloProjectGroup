package config

import (
	"fmt"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

type DataType string

const (
	TypeInt16    DataType = "int16"
	TypeUint16   DataType = "uint16"
	TypeInt32    DataType = "int32"
	TypeUint32   DataType = "uint32"
	TypeFloat32  DataType = "float32"
	TypeFloat64  DataType = "float64"
)

type RegisterType string

const (
	TypeHolding RegisterType = "holding"
	TypeInput   RegisterType = "input"
)

type RegisterConfig struct {
	Name          string       `yaml:"name"`
	Address       uint16       `yaml:"address"`
	Type          RegisterType `yaml:"type"`
	DataType      DataType     `yaml:"dataType"`
	ScaleFactor   float64      `yaml:"scaleFactor"`
	Offset        float64      `yaml:"offset"`
	Unit          string       `yaml:"unit"`
	ChangeThreshold float64    `yaml:"changeThreshold"`
	MovingAvgWindow int        `yaml:"movingAvgWindow"`
}

type ModbusConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	SlaveID  byte   `yaml:"slaveId"`
	PollInterval int `yaml:"pollInterval"`
	Timeout  int    `yaml:"timeout"`
}

type MQTTConfig struct {
	Broker   string `yaml:"broker"`
	Port     int    `yaml:"port"`
	ClientID string `yaml:"clientId"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Topic    string `yaml:"topic"`
	QoS      byte   `yaml:"qos"`
}

type AlarmThreshold struct {
	Name     string  `yaml:"name"`
	MinValue float64 `yaml:"minValue"`
	MaxValue float64 `yaml:"maxValue"`
}

type EdgeConfig struct {
	EnableMovingAvg bool              `yaml:"enableMovingAvg"`
	EnableThresholdAlarm bool          `yaml:"enableThresholdAlarm"`
	AlarmThresholds []AlarmThreshold  `yaml:"alarmThresholds"`
}

type DeviceConfig struct {
	DeviceID  string           `yaml:"deviceId"`
	Modbus    ModbusConfig     `yaml:"modbus"`
	Registers []RegisterConfig `yaml:"registers"`
}

type StorageConfig struct {
	Enabled        bool   `yaml:"enabled"`
	DBPath         string `yaml:"dbPath"`
	MaxRetries     int    `yaml:"maxRetries"`
	RetryBatchSize int    `yaml:"retryBatchSize"`
	CleanupDays    int    `yaml:"cleanupDays"`
}

type PoolConfig struct {
	WorkerCount int `yaml:"workerCount"`
	QueueSize   int `yaml:"queueSize"`
}

type MetricsConfig struct {
	Enabled bool   `yaml:"enabled"`
	Path    string `yaml:"path"`
}

type Config struct {
	Devices   []DeviceConfig  `yaml:"devices"`
	MQTT      MQTTConfig      `yaml:"mqtt"`
	Edge      EdgeConfig      `yaml:"edge"`
	Storage   StorageConfig   `yaml:"storage"`
	Pool      PoolConfig      `yaml:"pool"`
	Metrics   MetricsConfig   `yaml:"metrics"`
}

var (
	config     *Config
	configLock sync.RWMutex
	configPath string
)

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	if err := validateConfig(&cfg); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	configLock.Lock()
	defer configLock.Unlock()
	config = &cfg
	configPath = path

	return &cfg, nil
}

func Reload() (*Config, error) {
	configLock.RLock()
	path := configPath
	configLock.RUnlock()

	if path == "" {
		return nil, fmt.Errorf("config not loaded yet")
	}

	return Load(path)
}

func Get() *Config {
	configLock.RLock()
	defer configLock.RUnlock()
	return config
}

func validateConfig(cfg *Config) error {
	if len(cfg.Devices) == 0 {
		return fmt.Errorf("at least one device is required")
	}
	if cfg.MQTT.Broker == "" {
		return fmt.Errorf("mqtt broker is required")
	}
	if cfg.MQTT.Port <= 0 {
		return fmt.Errorf("mqtt port is required")
	}

	deviceIds := make(map[string]bool)
	for i, device := range cfg.Devices {
		if device.DeviceID == "" {
			return fmt.Errorf("device %d deviceId is required", i)
		}
		if deviceIds[device.DeviceID] {
			return fmt.Errorf("duplicate deviceId: %s", device.DeviceID)
		}
		deviceIds[device.DeviceID] = true

		if device.Modbus.Host == "" {
			return fmt.Errorf("device %s modbus host is required", device.DeviceID)
		}
		if device.Modbus.Port <= 0 {
			return fmt.Errorf("device %s modbus port is required", device.DeviceID)
		}
		if len(device.Registers) == 0 {
			return fmt.Errorf("device %s at least one register is required", device.DeviceID)
		}

		for j, reg := range device.Registers {
			if reg.Name == "" {
				return fmt.Errorf("device %s register %d name is required", device.DeviceID, j)
			}
			if reg.DataType == "" {
				return fmt.Errorf("device %s register %s dataType is required", device.DeviceID, reg.Name)
			}
			if reg.ScaleFactor == 0 {
				cfg.Devices[i].Registers[j].ScaleFactor = 1.0
			}
			if reg.MovingAvgWindow <= 0 {
				cfg.Devices[i].Registers[j].MovingAvgWindow = 5
			}
		}
	}

	if cfg.Storage.Enabled && cfg.Storage.DBPath == "" {
		cfg.Storage.DBPath = "modbus_data.db"
	}
	if cfg.Storage.MaxRetries <= 0 {
		cfg.Storage.MaxRetries = 10
	}
	if cfg.Storage.RetryBatchSize <= 0 {
		cfg.Storage.RetryBatchSize = 50
	}
	if cfg.Storage.CleanupDays <= 0 {
		cfg.Storage.CleanupDays = 7
	}

	if cfg.Pool.WorkerCount <= 0 {
		cfg.Pool.WorkerCount = 3
	}
	if cfg.Pool.QueueSize <= 0 {
		cfg.Pool.QueueSize = 100
	}

	if cfg.Metrics.Path == "" {
		cfg.Metrics.Path = "/metrics"
	}

	return nil
}
