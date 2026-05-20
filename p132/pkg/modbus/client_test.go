package modbus

import (
	"testing"
	"time"

	"modbus-mqtt-gateway/pkg/config"
)

func TestNewClient(t *testing.T) {
	cfg := config.ModbusConfig{
		Host:     "localhost",
		Port:     502,
		SlaveID:  1,
		Timeout:  5000,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client == nil {
		t.Fatal("Client is nil")
	}

	if client.reconnectInterval != 5*time.Second {
		t.Errorf("Expected reconnectInterval to be 5s, got %v", client.reconnectInterval)
	}
}

func TestClientDisconnect(t *testing.T) {
	cfg := config.ModbusConfig{
		Host:     "localhost",
		Port:     502,
		SlaveID:  1,
		Timeout:  5000,
	}

	client, _ := NewClient(cfg)
	
	err := client.Disconnect()
	if err != nil {
		t.Errorf("Disconnect returned error: %v", err)
	}
}

func TestClientIsConnected(t *testing.T) {
	cfg := config.ModbusConfig{
		Host:     "localhost",
		Port:     502,
		SlaveID:  1,
		Timeout:  5000,
	}

	client, _ := NewClient(cfg)
	
	connected := client.IsConnected()
	if connected {
		t.Error("Expected IsConnected to be false initially")
	}
}
