package modbus

import (
	"fmt"
	"sync"
	"time"

	"github.com/grid-x/modbus"
	"modbus-mqtt-gateway/pkg/config"
	"modbus-mqtt-gateway/pkg/converter"
)

type Client struct {
	handler   modbus.ClientHandler
	client    modbus.Client
	config    config.ModbusConfig
	connected bool
	mu        sync.Mutex
	lastReconnect time.Time
	reconnectInterval time.Duration
}

func NewClient(cfg config.ModbusConfig) (*Client, error) {
	client := &Client{
		config:            cfg,
		connected:         false,
		reconnectInterval: 5 * time.Second,
	}
	if err := client.recreateHandler(); err != nil {
		return nil, err
	}
	return client, nil
}

func (c *Client) recreateHandler() error {
	if c.handler != nil {
		c.handler.Close()
	}
	handler := modbus.NewTCPClientHandler(fmt.Sprintf("%s:%d", c.config.Host, c.config.Port))
	handler.SlaveId = c.config.SlaveID
	handler.Timeout = time.Duration(c.config.Timeout) * time.Millisecond
	c.handler = handler
	c.client = modbus.NewClient(handler)
	return nil
}

func (c *Client) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.handler.Connect(); err != nil {
		c.connected = false
		return fmt.Errorf("failed to connect to modbus device: %w", err)
	}
	c.connected = true
	c.lastReconnect = time.Now()
	return nil
}

func (c *Client) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.handler != nil {
		c.handler.Close()
		c.connected = false
	}
	return nil
}

func (c *Client) IsConnected() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connected
}

func (c *Client) tryReconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	if time.Since(c.lastReconnect) < c.reconnectInterval {
		return fmt.Errorf("reconnecting too frequently, please wait")
	}

	if err := c.recreateHandler(); err != nil {
		c.lastReconnect = time.Now()
		return fmt.Errorf("failed to recreate handler: %w", err)
	}

	if err := c.handler.Connect(); err != nil {
		c.lastReconnect = time.Now()
		return fmt.Errorf("failed to connect to modbus device: %w", err)
	}

	c.connected = true
	c.lastReconnect = time.Now()
	return nil
}

func (c *Client) ReadRegister(reg config.RegisterConfig) (converter.RegisterData, error) {
	if !c.connected {
		if err := c.tryReconnect(); err != nil {
			return converter.RegisterData{}, err
		}
	}

	count := uint16(converter.GetRegisterCount(reg.DataType))
	var data []byte
	var err error

	c.mu.Lock()
	switch reg.Type {
	case config.TypeHolding:
		data, err = c.client.ReadHoldingRegisters(reg.Address, count)
	case config.TypeInput:
		data, err = c.client.ReadInputRegisters(reg.Address, count)
	default:
		c.mu.Unlock()
		return converter.RegisterData{}, fmt.Errorf("unknown register type: %s", reg.Type)
	}
	c.mu.Unlock()

	if err != nil {
		c.mu.Lock()
		c.connected = false
		c.mu.Unlock()
		return converter.RegisterData{}, fmt.Errorf("failed to read register %s: %w", reg.Name, err)
	}

	rawValue, err := converter.ConvertToFloat(data, reg.DataType)
	if err != nil {
		return converter.RegisterData{}, err
	}

	value := converter.ApplyScaleAndOffset(rawValue, reg.ScaleFactor, reg.Offset)

	return converter.RegisterData{
		Register:  reg,
		RawValue:  rawValue,
		Value:     value,
		Timestamp: time.Now().Unix(),
	}, nil
}

func (c *Client) ReadAllRegisters(registers []config.RegisterConfig) ([]converter.RegisterData, error) {
	var results []converter.RegisterData
	var errs []error

	for _, reg := range registers {
		data, err := c.ReadRegister(reg)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		results = append(results, data)
	}

	if len(errs) > 0 {
		return results, fmt.Errorf("encountered %d errors reading registers", len(errs))
	}

	return results, nil
}
