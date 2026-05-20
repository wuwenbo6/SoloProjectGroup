package plc_cluster

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net"
	"plc-simulator/internal/modbus"
	"sync"
	"time"
)

// NewPLCCluster 创建PLC集群管理器
func NewPLCCluster() *PLCCluster {
	return &PLCCluster{
		plcMap:      make(map[string]*PLC),
		variableMap: make(map[string]*PLCVariable),
		stopChan:    make(chan struct{}),
		state: ClusterState{
			SyncCycle: 100, // 默认100ms同步周期
		},
	}
}

// InitFromConfig 从配置初始化集群
func (c *PLCCluster) InitFromConfig(config ClusterConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, plcConfig := range config.PLCs {
		plc := &PLC{
			ID:          plcConfig.ID,
			Name:        plcConfig.Name,
			Type:        PLCType(plcConfig.Type),
			IPAddress:   plcConfig.IPAddress,
			Port:        plcConfig.Port,
			SlaveID:     plcConfig.SlaveID,
			Status:      PLCStatusDisconnected,
			Description: plcConfig.Description,
		}
		c.plcMap[plcConfig.ID] = plc

		if plc.Type == PLCTypeMaster {
			c.state.MasterID = plc.ID
		} else {
			c.state.Slaves = append(c.state.Slaves, plc.ID)
		}
	}

	if config.SyncCycle > 0 {
		c.state.SyncCycle = config.SyncCycle
	}

	log.Printf("PLC集群初始化完成: Master=%s, Slaves=%d, SyncCycle=%dms",
		c.state.MasterID, len(c.state.Slaves), c.state.SyncCycle)

	return nil
}

// AddPLC 添加PLC节点
func (c *PLCCluster) AddPLC(plc *PLC) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.plcMap[plc.ID]; exists {
		return fmt.Errorf("PLC %s 已存在", plc.ID)
	}

	c.plcMap[plc.ID] = plc
	if plc.Type == PLCTypeSlave {
		c.state.Slaves = append(c.state.Slaves, plc.ID)
	} else if plc.Type == PLCTypeMaster {
		c.state.MasterID = plc.ID
	}

	return nil
}

// RemovePLC 移除PLC节点
func (c *PLCCluster) RemovePLC(plcID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.plcMap[plcID]; !exists {
		return fmt.Errorf("PLC %s 不存在", plcID)
	}

	delete(c.plcMap, plcID)

	// 从Slave列表移除
	for i, id := range c.state.Slaves {
		if id == plcID {
			c.state.Slaves = append(c.state.Slaves[:i], c.state.Slaves[i+1:]...)
			break
		}
	}

	if c.state.MasterID == plcID {
		c.state.MasterID = ""
	}

	return nil
}

// GetPLC 获取PLC信息
func (c *PLCCluster) GetPLC(plcID string) (*PLC, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	plc, exists := c.plcMap[plcID]
	return plc, exists
}

// GetAllPLCs 获取所有PLC列表
func (c *PLCCluster) GetAllPLCs() []*PLC {
	c.mu.RLock()
	defer c.mu.RUnlock()

	plcs := make([]*PLC, 0, len(c.plcMap))
	for _, plc := range c.plcMap {
		plcs = append(plcs, plc)
	}
	return plcs
}

// GetState 获取集群状态
func (c *PLCCluster) GetState() ClusterState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state
}

// AddVariableMapping 添加变量映射
func (c *PLCCluster) AddVariableMapping(variable *PLCVariable) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	id := variable.PLCID + "_" + variable.LocalName
	c.variableMap[id] = variable
	return nil
}

// GetMappedVariables 获取PLC的映射变量
func (c *PLCCluster) GetMappedVariables(plcID string) []*PLCVariable {
	c.mu.RLock()
	defer c.mu.RUnlock()

	vars := make([]*PLCVariable, 0)
	for _, v := range c.variableMap {
		if v.PLCID == plcID {
			vars = append(vars, v)
		}
	}
	return vars
}

// Start 启动集群
func (c *PLCCluster) Start() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.running {
		return fmt.Errorf("集群已在运行")
	}

	c.running = true
	c.syncTicker = time.NewTicker(time.Duration(c.state.SyncCycle) * time.Millisecond)

	go c.syncLoop()

	log.Println("PLC集群已启动")
	return nil
}

// Stop 停止集群
func (c *PLCCluster) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.running {
		return
	}

	c.running = false
	if c.syncTicker != nil {
		c.syncTicker.Stop()
	}
	close(c.stopChan)

	log.Println("PLC集群已停止")
}

// syncLoop 主同步循环
func (c *PLCCluster) syncLoop() {
	for {
		select {
		case <-c.syncTicker.C:
			c.performSync()
		case <-c.stopChan:
			return
		}
	}
}

// performSync 执行一次同步
func (c *PLCCluster) performSync() {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.state.MasterID == "" {
		return
	}

	master, exists := c.plcMap[c.state.MasterID]
	if !exists {
		return
	}

	// Master 向所有 Slave 同步数据
	var wg sync.WaitGroup
	for _, slaveID := range c.state.Slaves {
		if slave, exists := c.plcMap[slaveID]; exists {
			wg.Add(1)
			go func(m, s *PLC) {
				defer wg.Done()
				c.syncPLCs(m, s)
			}(master, slave)
		}
	}

	wg.Wait()
}

// syncPLCs 同步两个PLC的数据
func (c *PLCCluster) syncPLCs(master, slave *PLC) {
	master.Status = PLCStatusConnected
	master.LastSeen = time.Now()
	slave.Status = PLCStatusConnected
	slave.LastSeen = time.Now()
}

// ReadPLCData 读取PLC数据
func (c *PLCCluster) ReadPLCData(plcID string) (*PLCData, error) {
	plc, exists := c.GetPLC(plcID)
	if !exists {
		return nil, fmt.Errorf("PLC %s 不存在", plcID)
	}

	client := modbus.NewClient(plc.IPAddress, plc.Port, plc.SlaveID)
	if err := client.Connect(); err != nil {
		plc.Status = PLCStatusError
		plc.ErrorCount++
		return nil, err
	}
	defer client.Disconnect()

	coils, err := client.ReadCoils(0, 32)
	if err != nil {
		plc.Status = PLCStatusError
		plc.ErrorCount++
		return nil, err
	}

	registers, err := client.ReadHoldingRegisters(0, 32)
	if err != nil {
		plc.Status = PLCStatusError
		plc.ErrorCount++
		return nil, err
	}

	plc.Status = PLCStatusConnected
	plc.LastSeen = time.Now()

	data := &PLCData{
		PLCID:    plcID,
		Inputs:    make(map[string]bool),
		Outputs:   make(map[string]bool),
		Registers: make(map[string]uint16),
		Timestamp: time.Now(),
	}

	for i, val := range coils {
		if i < 16 {
			data.Inputs[fmt.Sprintf("I%d", i)] = val
		} else {
			data.Outputs[fmt.Sprintf("Q%d", i-16)] = val
		}
	}

	for i, val := range registers {
		data.Registers[fmt.Sprintf("R%d", i)] = val
	}

	return data, nil
}

// WritePLCData 写入PLC数据
func (c *PLCCluster) WritePLCData(plcID string, addr string, value bool) error {
	plc, exists := c.GetPLC(plcID)
	if !exists {
		return fmt.Errorf("PLC %s 不存在", plcID)
	}

	client := modbus.NewClient(plc.IPAddress, plc.Port, plc.SlaveID)
	if err := client.Connect(); err != nil {
		plc.Status = PLCStatusError
		plc.ErrorCount++
		return err
	}
	defer client.Disconnect()

	addrInt := 0
	fmt.Sscanf(addr, "Q%d", &addrInt)

	if err := client.WriteSingleCoil(uint16(addrInt+16), value); err != nil {
		plc.Status = PLCStatusError
		plc.ErrorCount++
		return err
	}

	plc.Status = PLCStatusConnected
	plc.LastSeen = time.Now()
	return nil
}

// IsRunning 检查集群是否运行
func (c *PLCCluster) IsRunning() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.running
}

// TestConnection 测试PLC连接
func (c *PLCCluster) TestConnection(plcID string) error {
	plc, exists := c.GetPLC(plcID)
	if !exists {
		return fmt.Errorf("PLC %s 不存在", plcID)
	}

	client := modbus.NewClient(plc.IPAddress, plc.Port, plc.SlaveID)
	if err := client.Connect(); err != nil {
		return err
	}
	defer client.Disconnect()

	return nil
}

// SimulatePLCData 模拟PLC数据（用于演示）
func (c *PLCCluster) SimulatePLCData(plcID string) *PLCData {
	plc, exists := c.GetPLC(plcID)
	if !exists {
		return nil
	}

	inputs := make(map[string]bool)
	outputs := make(map[string]bool)
	registers := make(map[string]uint16)

	// 生成随机模拟数据
	for i := 0; i < 16; i++ {
		inputs[fmt.Sprintf("I0.%d", i)] = rand.Float32() > 0.5
		outputs[fmt.Sprintf("Q0.%d", i)] = rand.Float32() > 0.5
		registers[fmt.Sprintf("R%d", i)] = uint16(rand.Intn(1000))
	}

	plc.Status = PLCStatusConnected
	plc.LastSeen = time.Now()

	return &PLCData{
		PLCID:    plcID,
		Inputs:    inputs,
		Outputs:   outputs,
		Registers: registers,
		Timestamp: time.Now(),
	}
}

// ToJSON 序列化
func (c *PLCCluster) ToJSON() ([]byte, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data := map[string]interface{}{
		"state": c.state,
		"plcs":  c.plcMap,
		"variables": c.variableMap,
	}
	return json.MarshalIndent(data, "", "  ")
}
