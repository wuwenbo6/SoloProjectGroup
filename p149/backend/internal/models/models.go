package models

import "time"

// Project 项目模型
type Project struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	XMLData     string    `json:"xmlData" db:"xml_data"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// Variable 变量模型
type Variable struct {
	Name   string      `json:"name"`
	Type   string      `json:"type"` // I, Q, M, T
	Value  interface{} `json:"value"`
	Forced bool        `json:"forced"`
}

// Timer 定时器模型
type Timer struct {
	Name     string `json:"name"`
	Preset   int    `json:"preset"`   // 预设值 (ms)
	Current  int    `json:"current"`  // 当前值 (ms)
	Input    bool   `json:"input"`    // 输入状态
	Output   bool   `json:"output"`   // 输出状态
	Running  bool   `json:"running"`  // 是否正在运行
}

// LadderLogic 梯形图逻辑单元
type LadderLogic struct {
	Type     string      `json:"type"` // contact_no, contact_nc, coil_out, timer_ton, etc.
	Var      string      `json:"var,omitempty"`
	Input    interface{} `json:"input,omitempty"`
	Left     interface{} `json:"left,omitempty"`
	Right    interface{} `json:"right,omitempty"`
	Operator string      `json:"operator,omitempty"`
}

// Rung 梯级
type Rung struct {
	Logic interface{} `json:"logic"`
}

// WebsocketMessage WebSocket消息
type WebsocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// ModbusConfig Modbus配置
type ModbusConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	SlaveID  byte   `json:"slaveId"`
	TimeoutMs int   `json:"timeoutMs,omitempty"` // 超时时间（毫秒）
}

// ModbusWriteRequest Modbus写入请求
type ModbusWriteRequest struct {
	Address uint16 `json:"address"`
	Value   bool   `json:"value"`   // 线圈值
	RegVal  uint16 `json:"regVal"`  // 寄存器值
}

// ModbusReadRequest Modbus读取请求
type ModbusReadRequest struct {
	Address uint16 `json:"address"`
	Count   uint16 `json:"count"`
}
