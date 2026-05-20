package mqtt

import (
	"testing"

	"modbus-mqtt-gateway/pkg/config"
)

func TestNewClient(t *testing.T) {
	cfg := config.MQTTConfig{
		Broker:   "localhost",
		Port:     1883,
		ClientID: "test-gateway",
		QoS:      1,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client == nil {
		t.Fatal("Client is nil")
	}

	if client.maxCachedMsgs != 100 {
		t.Errorf("Expected maxCachedMsgs to be 100, got %d", client.maxCachedMsgs)
	}
}

func TestMessageDeduplication(t *testing.T) {
	cfg := config.MQTTConfig{
		Broker:   "localhost",
		Port:     1883,
		ClientID: "test-gateway",
		QoS:      1,
	}

	client, _ := NewClient(cfg)

	msgID := "test-msg-123"

	if client.isDuplicateMessage(msgID) {
		t.Error("New message should not be duplicate")
	}

	client.addPublishedMessage(msgID)

	if !client.isDuplicateMessage(msgID) {
		t.Error("Message should be detected as duplicate")
	}
}

func TestMessageCacheEviction(t *testing.T) {
	cfg := config.MQTTConfig{
		Broker:   "localhost",
		Port:     1883,
		ClientID: "test-gateway",
		QoS:      1,
	}

	client, _ := NewClient(cfg)
	client.maxCachedMsgs = 5

	for i := 0; i < 10; i++ {
		msgID := "test-msg-" + string(rune(i))
		client.addPublishedMessage(msgID)
	}

	if client.publishedMsgs.Len() > client.maxCachedMsgs {
		t.Errorf("Cache should not exceed max size %d, got %d", 
			client.maxCachedMsgs, client.publishedMsgs.Len())
	}
}

func TestClientIsConnected(t *testing.T) {
	cfg := config.MQTTConfig{
		Broker:   "localhost",
		Port:     1883,
		ClientID: "test-gateway",
		QoS:      1,
	}

	client, _ := NewClient(cfg)

	connected := client.IsConnected()
	if connected {
		t.Error("Expected IsConnected to be false initially")
	}
}
