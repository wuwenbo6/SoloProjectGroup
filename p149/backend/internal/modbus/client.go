package modbus

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"
)

const (
	// DefaultTimeout 默认超时时间 (毫秒)
	DefaultTimeout = 500
	// ConnectTimeout 连接超时时间 (毫秒)
	ConnectTimeout = 2000
	// MaxRetries 最大重试次数
	MaxRetries = 3
	// RetryInterval 重试间隔 (毫秒)
	RetryInterval = 100
)

// Client Modbus TCP 客户端（带超时保护）
type Client struct {
	mu          sync.RWMutex
	conn        net.Conn
	host        string
	port        int
	slaveID     byte
	connected   bool
	timeout     time.Duration
	lastError   error
	retryCount  int
	// 看门狗相关
	lastActivity time.Time
	maxIdleTime  time.Duration
}

// NewClient 创建新的Modbus客户端
func NewClient(host string, port int, slaveID byte) *Client {
	return &Client{
		host:        host,
		port:        port,
		slaveID:     slaveID,
		timeout:     time.Duration(DefaultTimeout) * time.Millisecond,
		maxIdleTime: 30 * time.Second, // 30秒空闲超时
	}
}

// Connect 连接到Modbus服务器（带超时）
func (c *Client) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.connected {
		return nil
	}

	// 带超时的连接
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(ConnectTimeout)*time.Millisecond)
	defer cancel()

	dialer := net.Dialer{}
	conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", c.host, c.port))
	if err != nil {
		c.lastError = fmt.Errorf("连接失败: %w", err)
		return c.lastError
	}

	c.conn = conn
	c.connected = true
	c.lastActivity = time.Now()
	c.retryCount = 0
	c.lastError = nil

	return nil
}

// Disconnect 断开连接
func (c *Client) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected || c.conn == nil {
		return nil
	}

	err := c.conn.Close()
	c.connected = false
	c.conn = nil
	return err
}

// checkConnection 检查并恢复连接
func (c *Client) checkConnection() error {
	if !c.connected || c.conn == nil {
		if c.retryCount >= MaxRetries {
			return errors.New("超过最大重试次数，连接已断开")
		}

		c.retryCount++
		if err := c.Connect(); err != nil {
			return err
		}
	}

	// 检查空闲时间
	if time.Since(c.lastActivity) > c.maxIdleTime {
		// 空闲时间过长，重建连接
		c.conn.Close()
		c.connected = false
		return c.Connect()
	}

	return nil
}

// sendWithRetry 带重试发送请求
func (c *Client) sendWithRetry(adu []byte) ([]byte, error) {
	var lastErr error

	for attempt := 0; attempt < MaxRetries; attempt++ {
		if err := c.checkConnection(); err != nil {
			lastErr = err
			time.Sleep(time.Duration(RetryInterval) * time.Millisecond)
			continue
		}

		// 设置读写超时
		c.conn.SetDeadline(time.Now().Add(c.timeout))

		// 发送请求
		_, err := c.conn.Write(adu)
		if err != nil {
			lastErr = err
			c.connected = false
			time.Sleep(time.Duration(RetryInterval) * time.Millisecond)
			continue
		}

		// 读取响应
		response := make([]byte, 260) // Modbus最大响应长度
		n, err := c.conn.Read(response)
		if err != nil {
			lastErr = err
			c.connected = false
			time.Sleep(time.Duration(RetryInterval) * time.Millisecond)
			continue
		}

		c.lastActivity = time.Now()
		c.retryCount = 0
		return response[:n], nil
	}

	c.lastError = lastErr
	return nil, fmt.Errorf("发送失败，已重试 %d 次: %w", MaxRetries, lastErr)
}

// buildADU 构建Modbus ADU (Application Data Unit)
func (c *Client) buildADU(functionCode byte, pdu []byte) []byte {
	// MBAP Header
	adu := make([]byte, 7+len(pdu))
	adu[0] = 0x00 // Transaction Identifier (Hi)
	adu[1] = 0x01 // Transaction Identifier (Lo)
	adu[2] = 0x00 // Protocol Identifier (Hi)
	adu[3] = 0x00 // Protocol Identifier (Lo)
	adu[4] = byte(len(pdu) >> 8)   // Length (Hi)
	adu[5] = byte(len(pdu) & 0xFF) // Length (Lo)
	adu[6] = c.slaveID             // Unit Identifier

	// PDU
	copy(adu[7:], pdu)

	return adu
}

// ReadCoils 读取线圈状态 (功能码 0x01)
func (c *Client) ReadCoils(address uint16, quantity uint16) ([]bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 构建PDU
	pdu := make([]byte, 5)
	pdu[0] = 0x01 // Function Code
	pdu[1] = byte(address >> 8)      // Starting Address (Hi)
	pdu[2] = byte(address & 0xFF)    // Starting Address (Lo)
	pdu[3] = byte(quantity >> 8)     // Quantity (Hi)
	pdu[4] = byte(quantity & 0xFF)   // Quantity (Lo)

	adu := c.buildADU(0x01, pdu)
	response, err := c.sendWithRetry(adu)
	if err != nil {
		return nil, err
	}

	// 解析响应 (简化版本)
	if len(response) < 9 {
		return nil, errors.New("响应数据太短")
	}

	byteCount := int(response[8])
	coils := make([]bool, quantity)

	for i := 0; i < byteCount && i < len(coils)/8+1; i++ {
		if 9+i >= len(response) {
			break
		}
		b := response[9+i]
		for bit := 0; bit < 8 && i*8+bit < int(quantity); bit++ {
			coils[i*8+bit] = (b & (1 << bit)) != 0
		}
	}

	return coils, nil
}

// WriteSingleCoil 写入单个线圈 (功能码 0x05)
func (c *Client) WriteSingleCoil(address uint16, value bool) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 构建PDU
	pdu := make([]byte, 5)
	pdu[0] = 0x05 // Function Code
	pdu[1] = byte(address >> 8)      // Address (Hi)
	pdu[2] = byte(address & 0xFF)    // Address (Lo)
	if value {
		pdu[3] = 0xFF
		pdu[4] = 0x00
	} else {
		pdu[3] = 0x00
		pdu[4] = 0x00
	}

	adu := c.buildADU(0x05, pdu)
	_, err := c.sendWithRetry(adu)
	return err
}

// ReadHoldingRegisters 读取保持寄存器 (功能码 0x03)
func (c *Client) ReadHoldingRegisters(address uint16, quantity uint16) ([]uint16, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 构建PDU
	pdu := make([]byte, 5)
	pdu[0] = 0x03 // Function Code
	pdu[1] = byte(address >> 8)      // Starting Address (Hi)
	pdu[2] = byte(address & 0xFF)    // Starting Address (Lo)
	pdu[3] = byte(quantity >> 8)     // Quantity (Hi)
	pdu[4] = byte(quantity & 0xFF)   // Quantity (Lo)

	adu := c.buildADU(0x03, pdu)
	response, err := c.sendWithRetry(adu)
	if err != nil {
		return nil, err
	}

	// 解析响应
	if len(response) < 9 {
		return nil, errors.New("响应数据太短")
	}

	byteCount := int(response[8])
	registers := make([]uint16, 0, byteCount/2)

	for i := 0; i < byteCount; i += 2 {
		if 9+i+1 >= len(response) {
			break
		}
		reg := uint16(response[9+i])<<8 | uint16(response[9+i+1])
		registers = append(registers, reg)
	}

	return registers, nil
}

// WriteSingleRegister 写入单个寄存器 (功能码 0x06)
func (c *Client) WriteSingleRegister(address uint16, value uint16) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 构建PDU
	pdu := make([]byte, 5)
	pdu[0] = 0x06 // Function Code
	pdu[1] = byte(address >> 8)      // Address (Hi)
	pdu[2] = byte(address & 0xFF)    // Address (Lo)
	pdu[3] = byte(value >> 8)        // Value (Hi)
	pdu[4] = byte(value & 0xFF)      // Value (Lo)

	adu := c.buildADU(0x06, pdu)
	_, err := c.sendWithRetry(adu)
	return err
}

// IsConnected 检查是否已连接
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

// GetLastError 获取最后错误
func (c *Client) GetLastError() error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastError
}

// SetTimeout 设置超时时间
func (c *Client) SetTimeout(timeoutMs int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.timeout = time.Duration(timeoutMs) * time.Millisecond
}

// GetStats 获取连接统计
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return map[string]interface{}{
		"connected":    c.connected,
		"host":         c.host,
		"port":         c.port,
		"slave_id":     c.slaveID,
		"retry_count":  c.retryCount,
		"last_error":   c.lastError,
		"idle_seconds": time.Since(c.lastActivity).Seconds(),
	}
}

// HealthCheck 健康检查
func (c *Client) HealthCheck() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.connected {
		return errors.New("未连接")
	}

	// 尝试读取线圈0来检查连接
	_, err := c.ReadCoils(0, 1)
	return err
}
