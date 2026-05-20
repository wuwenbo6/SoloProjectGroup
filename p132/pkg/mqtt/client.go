package mqtt

import (
	"container/list"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"modbus-mqtt-gateway/pkg/config"
	"modbus-mqtt-gateway/pkg/edge"
)

type Storage interface {
	SavePayload(deviceId, topic, payload string, timestamp int64) error
}

type Client struct {
	client        mqtt.Client
	config        config.MQTTConfig
	storage       Storage
	publishedMsgs *list.List
	msgMutex      sync.Mutex
	maxCachedMsgs int
}

type MessagePayload struct {
	DeviceID   string                 `json:"deviceId"`
	Timestamp  int64                  `json:"timestamp"`
	Data       map[string]interface{} `json:"data"`
	Alarms     []string               `json:"alarms,omitempty"`
	MessageID  string                 `json:"msgId,omitempty"`
}

type cachedMessage struct {
	msgID     string
	timestamp time.Time
}

func NewClient(cfg config.MQTTConfig) (*Client, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(fmt.Sprintf("tcp://%s:%d", cfg.Broker, cfg.Port))
	opts.SetClientID(cfg.ClientID)
	if cfg.Username != "" {
		opts.SetUsername(cfg.Username)
	}
	if cfg.Password != "" {
		opts.SetPassword(cfg.Password)
	}
	opts.SetAutoReconnect(true)
	opts.SetKeepAlive(60 * time.Second)
	opts.SetCleanSession(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)
	opts.SetMaxReconnectInterval(30 * time.Second)

	client := mqtt.NewClient(opts)

	return &Client{
		client:        client,
		config:        cfg,
		publishedMsgs: list.New(),
		maxCachedMsgs: 100,
	}, nil
}

func (c *Client) SetStorage(storage Storage) {
	c.storage = storage
}

func (c *Client) Connect() error {
	if token := c.client.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("failed to connect to MQTT broker: %w", token.Error())
	}
	return nil
}

func (c *Client) Disconnect() {
	c.client.Disconnect(250)
}

func (c *Client) IsConnected() bool {
	return c.client.IsConnected()
}

func (c *Client) isDuplicateMessage(msgID string) bool {
	c.msgMutex.Lock()
	defer c.msgMutex.Unlock()

	now := time.Now()
	for e := c.publishedMsgs.Front(); e != nil; {
		cached := e.Value.(cachedMessage)
		if now.Sub(cached.timestamp) > 5*time.Minute {
			old := e
			e = e.Next()
			c.publishedMsgs.Remove(old)
		} else {
			if cached.msgID == msgID {
				return true
			}
			e = e.Next()
		}
	}
	return false
}

func (c *Client) addPublishedMessage(msgID string) {
	c.msgMutex.Lock()
	defer c.msgMutex.Unlock()

	c.publishedMsgs.PushBack(cachedMessage{
		msgID:     msgID,
		timestamp: time.Now(),
	})

	for c.publishedMsgs.Len() > c.maxCachedMsgs {
		c.publishedMsgs.Remove(c.publishedMsgs.Front())
	}
}

func (c *Client) PublishData(data []edge.ProcessedData, deviceId string) error {
	if !c.client.IsConnected() {
		if err := c.Connect(); err != nil {
			return err
		}
	}

	timestamp := time.Now().UnixNano()
	msgID := fmt.Sprintf("%s-%d", deviceId, timestamp)

	if c.isDuplicateMessage(msgID) {
		return nil
	}

	payload := MessagePayload{
		DeviceID:  deviceId,
		Timestamp: time.Now().Unix(),
		Data:      make(map[string]interface{}),
		Alarms:    []string{},
		MessageID: msgID,
	}

	for _, d := range data {
		if !d.ShouldReport {
			continue
		}

		payload.Data[d.Name] = map[string]interface{}{
			"value":     d.Value,
			"movingAvg": d.MovingAvg,
			"unit":      d.Unit,
			"alarm":     d.AlarmLevel,
		}

		if d.AlarmLevel != edge.AlarmNormal {
			payload.Alarms = append(payload.Alarms, fmt.Sprintf("%s_%s", d.Name, d.AlarmLevel))
		}
	}

	if len(payload.Data) == 0 {
		return nil
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	topic := fmt.Sprintf("%s/%s", c.config.Topic, deviceId)

	if c.storage != nil {
		c.storage.SavePayload(deviceId, topic, string(jsonData), payload.Timestamp)
	}

	token := c.client.Publish(topic, c.config.QoS, false, jsonData)
	
	publishTimeout := 10 * time.Second
	if !token.WaitTimeout(publishTimeout) {
		return fmt.Errorf("publish timeout after %v", publishTimeout)
	}
	
	if token.Error() != nil {
		return fmt.Errorf("failed to publish message: %w", token.Error())
	}

	c.addPublishedMessage(msgID)
	return nil
}

func (c *Client) Publish(topic string, payload interface{}) error {
	if !c.client.IsConnected() {
		if err := c.Connect(); err != nil {
			return err
		}
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	token := c.client.Publish(topic, c.config.QoS, false, jsonData)
	
	publishTimeout := 10 * time.Second
	if !token.WaitTimeout(publishTimeout) {
		return fmt.Errorf("publish timeout after %v", publishTimeout)
	}
	
	if token.Error() != nil {
		return fmt.Errorf("failed to publish message: %w", token.Error())
	}

	return nil
}
