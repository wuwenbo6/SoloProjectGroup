package plc_cluster

import (
	"plc-simulator/internal/models"
	"sync"
	"time"
)

// PLCType PLC 类型
type PLCType string

const (
	PLCTypeMaster  PLCType = "master"
	PLCTypeSlave   PLCType = "slave"
)

// PLCStatus PLC 状态
type PLCStatus string

const (
	PLCStatusConnected  PLCStatus = "connected"
	PLCStatusDisconnected PLCStatus = "disconnected"
	PLCStatusError      PLCStatus = "error"
)

// PLC PLC节点信息
type PLC struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        PLCType   `json:"type"`
	IPAddress   string    `json:"ipAddress"`
	Port        int       `json:"port"`
	SlaveID     byte      `json:"slaveId"`
	Status      PLCStatus `json:"status"`
	Description string    `json:"description"`
	LastSeen    time.Time `json:"lastSeen"`
	ErrorCount  int       `json:"errorCount"`
}

// PLCVariable PLC变量映射
type PLCVariable struct {
	ID         string `json:"id"`
	PLCID      string `json:"plcId"`
	LocalName  string `json:"localName"` // 本地变量名
	RemoteAddr string `json:"remoteAddr"` // 远程地址
	Type       string `json:"type"`       // coil, register
	Direction  string `json:"direction"`  // input, output
	Enabled    bool   `json:"enabled"`
}

// SyncMessage 同步消息
type SyncMessage struct {
	FromPLC string                 `json:"fromPlc"`
	ToPLC   string                 `json:"toPlc"`
	Type    string                 `json:"type"` // read, write, sync, ack
	Payload map[string]interface{} `json:"payload"`
	Time    time.Time              `json:"time"`
}

// ClusterState 集群状态
type ClusterState struct {
	MasterID  string           `json:"masterId"`
	Slaves    []string         `json:"slaves"`
	SyncCycle int64            `json:"syncCycle"` // 同步周期（毫秒）
}

// PLCCluster PLC集群管理器
type PLCCluster struct {
	mu         sync.RWMutex
	plcMap     map[string]*PLC
	variableMap map[string]*PLCVariable
	state      ClusterState
	running    bool
	stopChan   chan struct{}
	syncTicker *time.Ticker
}

// PLCConfig PLC配置
type PLCConfig struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	IPAddress   string  `json:"ipAddress"`
	Port        int     `json:"port"`
	SlaveID     byte    `json:"slaveId"`
	Description string  `json:"description"`
}

// ClusterConfig 集群配置
type ClusterConfig struct {
	MasterID   string     `json:"masterId"`
	PLCs       []PLCConfig `json:"plcs"`
	SyncCycle  int64      `json:"syncCycle"` // 毫秒
}

// PLCData PLC数据快照
type PLCData struct {
	PLCID    string                 `json:"plcId"`
	Inputs   map[string]bool        `json:"inputs"`
	Outputs  map[string]bool        `json:"outputs"`
	Registers map[string]uint16     `json:"registers"`
	Timestamp time.Time             `json:"timestamp"`
}
