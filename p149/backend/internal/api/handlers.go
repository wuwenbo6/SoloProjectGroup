package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"plc-simulator/internal/engine"
	"plc-simulator/internal/models"
	"plc-simulator/internal/modbus"
	"plc-simulator/internal/pdf_exporter"
	"plc-simulator/internal/plc_cluster"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	_ "modernc.org/sqlite"
)

var (
	db            *sql.DB
	modbusClient  *modbus.Client
	plcCluster    *plc_cluster.PLCCluster
	upgrader      = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // 允许所有来源
		},
	}
)

// InitPLCCluster 初始化PLC集群管理器
func InitPLCCluster() {
	plcCluster = plc_cluster.NewPLCCluster()
}

// InitDB 初始化数据库
func InitDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// 创建projects表
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		xml_data TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
	`
	_, err = db.Exec(createTableSQL)
	return err
}

// GetProjects 获取所有项目
func GetProjects(c *gin.Context) {
	rows, err := db.Query("SELECT id, name, description, xml_data, created_at, updated_at FROM projects ORDER BY updated_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.XMLData, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		projects = append(projects, p)
	}

	c.JSON(http.StatusOK, projects)
}

// GetProject 获取单个项目
func GetProject(c *gin.Context) {
	id := c.Param("id")
	var p models.Project
	err := db.QueryRow("SELECT id, name, description, xml_data, created_at, updated_at FROM projects WHERE id = ?", id).
		Scan(&p.ID, &p.Name, &p.Description, &p.XMLData, &p.CreatedAt, &p.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, p)
}

// CreateProject 创建新项目
func CreateProject(c *gin.Context) {
	var p models.Project
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p.ID = time.Now().Format("20060102150405")
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	_, err := db.Exec("INSERT INTO projects (id, name, description, xml_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		p.ID, p.Name, p.Description, p.XMLData, p.CreatedAt, p.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, p)
}

// UpdateProject 更新项目
func UpdateProject(c *gin.Context) {
	id := c.Param("id")
	var p models.Project
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	p.UpdatedAt = time.Now()
	_, err := db.Exec("UPDATE projects SET name = ?, description = ?, xml_data = ?, updated_at = ? WHERE id = ?",
		p.Name, p.Description, p.XMLData, p.UpdatedAt, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project updated successfully"})
}

// DeleteProject 删除项目
func DeleteProject(c *gin.Context) {
	id := c.Param("id")
	_, err := db.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// HandleWebSocket 处理WebSocket连接
func HandleWebSocket(c *gin.Context, simEngine *engine.Engine) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// 定期发送变量状态和引擎状态
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()

		for range ticker.C {
			variables := simEngine.GetAllVariables()
			stats := simEngine.GetStats()
			msg := models.WebsocketMessage{
				Type: "variables_update",
				Payload: gin.H{
					"variables":   variables,
					"cycleCount":  simEngine.CycleCount,
					"isRunning":   simEngine.IsRunning,
					"isHealthy":   simEngine.IsHealthy(),
					"engineStats": stats,
				},
			}
			conn.WriteJSON(msg)
		}
	}()

	// 处理客户端消息
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		msgType := msg["type"].(string)
		switch msgType {
		case "start_simulation":
			simEngine.Start()
		case "stop_simulation":
			simEngine.Stop()
		case "force_set":
			name := msg["variable"].(string)
			value := msg["value"].(bool)
			simEngine.SetVariable(name, value, true)
		case "release_force":
			name := msg["variable"].(string)
			simEngine.ReleaseForce(name)
		case "load_program":
			if program, ok := msg["program"].(string); ok {
				simEngine.LoadProgram(program)
			}
		}
	}
}

// GetEngineHealth 获取引擎健康状态
func GetEngineHealth(c *gin.Context, simEngine *engine.Engine) {
	c.JSON(http.StatusOK, gin.H{
		"healthy": simEngine.IsHealthy(),
		"stats":   simEngine.GetStats(),
	})
}

// Modbus处理器

// ConnectModbus 连接Modbus设备
func ConnectModbus(c *gin.Context) {
	var config models.ModbusConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 创建新的Modbus客户端
	modbusClient = modbus.NewClient(config.Host, config.Port, byte(config.SlaveID))
	
	// 设置超时
	if config.TimeoutMs > 0 {
		modbusClient.SetTimeout(config.TimeoutMs)
	}

	if err := modbusClient.Connect(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Modbus连接成功",
		"connected": true,
		"stats":     modbusClient.GetStats(),
	})
}

// DisconnectModbus 断开Modbus连接
func DisconnectModbus(c *gin.Context) {
	if modbusClient != nil {
		modbusClient.Disconnect()
	}
	c.JSON(http.StatusOK, gin.H{"message": "Modbus已断开"})
}

// ReadCoils 读取线圈
func ReadCoils(c *gin.Context) {
	if modbusClient == nil || !modbusClient.IsConnected() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Modbus未连接"})
		return
	}

	var req models.ModbusReadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coils, err := modbusClient.ReadCoils(req.Address, req.Count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address": req.Address,
		"count":   req.Count,
		"coils":   coils,
	})
}

// WriteCoil 写入线圈
func WriteCoil(c *gin.Context) {
	if modbusClient == nil || !modbusClient.IsConnected() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Modbus未连接"})
		return
	}

	var req models.ModbusWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := modbusClient.WriteSingleCoil(req.Address, req.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "写入成功",
		"address": req.Address,
		"value":   req.Value,
	})
}

// ReadRegisters 读取寄存器
func ReadRegisters(c *gin.Context) {
	if modbusClient == nil || !modbusClient.IsConnected() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Modbus未连接"})
		return
	}

	var req models.ModbusReadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	registers, err := modbusClient.ReadHoldingRegisters(req.Address, req.Count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"address":   req.Address,
		"count":     req.Count,
		"registers": registers,
	})
}

// WriteRegister 写入寄存器
func WriteRegister(c *gin.Context) {
	if modbusClient == nil || !modbusClient.IsConnected() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Modbus未连接"})
		return
	}

	var req models.ModbusWriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := modbusClient.WriteSingleRegister(req.Address, req.RegVal); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "写入成功",
		"address": req.Address,
		"value":   req.RegVal,
	})
}

// GetModbusStatus 获取Modbus连接状态
func GetModbusStatus(c *gin.Context) {
	if modbusClient == nil {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"message":   "Modbus客户端未初始化",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connected": modbusClient.IsConnected(),
		"stats":     modbusClient.GetStats(),
		"lastError": modbusClient.GetLastError(),
	})
}

// ==================== PLC集群管理API ====================

// GetClusterState 获取集群状态
func GetClusterState(c *gin.Context) {
	state := plcCluster.GetState()
	plcs := plcCluster.GetAllPLCs()
	c.JSON(http.StatusOK, gin.H{
		"state":   state,
		"plcs":    plcs,
		"running": plcCluster.IsRunning(),
	})
}

// AddPLC 添加PLC节点
func AddPLC(c *gin.Context) {
	var plc plc_cluster.PLC
	if err := c.ShouldBindJSON(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := plcCluster.AddPLC(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC添加成功", "plc": plc})
}

// RemovePLC 移除PLC节点
func RemovePLC(c *gin.Context) {
	plcID := c.Param("id")
	if err := plcCluster.RemovePLC(plcID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC移除成功"})
}

// StartCluster 启动集群同步
func StartCluster(c *gin.Context) {
	if err := plcCluster.Start(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "集群同步已启动"})
}

// StopCluster 停止集群同步
func StopCluster(c *gin.Context) {
	plcCluster.Stop()
	c.JSON(http.StatusOK, gin.H{"message": "集群同步已停止"})
}

// ReadPLCData 读取PLC数据
func ReadPLCData(c *gin.Context) {
	plcID := c.Param("id")
	data, err := plcCluster.ReadPLCData(plcID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}

// WritePLCData 写入PLC数据
func WritePLCData(c *gin.Context) {
	plcID := c.Param("id")
	var req struct {
		Addr  string `json:"addr"`
		Value bool   `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := plcCluster.WritePLCData(plcID, req.Addr, req.Value); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "写入成功"})
}

// TestPLCConnection 测试PLC连接
func TestPLCConnection(c *gin.Context) {
	plcID := c.Param("id")
	if err := plcCluster.TestConnection(plcID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "连接失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "连接成功"})
}

// ==================== PDF导出API ====================

// ExportLadderToPDF 导出梯形图为PDF
func ExportLadderToPDF(c *gin.Context) {
	var req struct {
		Rungs      []interface{}        `json:"rungs"`
		Variables  []pdf_exporter.Variable `json:"variables"`
		Title      string               `json:"title"`
		Author     string               `json:"author"`
		Description string              `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := pdf_exporter.ExportConfig{
		Title:       req.Title,
		Author:      req.Author,
		Description: req.Description,
		PageSize:    "A4",
		Orientation: "P",
		IncludeDate: true,
	}

	data := pdf_exporter.LadderDiagramData{
		Variables: req.Variables,
	}

	result, err := pdf_exporter.ExportLadderToPDF(data, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename=\""+result.Filename+"\"")
	c.Data(http.StatusOK, "application/pdf", result.Data)
}

// ExportFBDToPDF 导出功能块图为PDF
func ExportFBDToPDF(c *gin.Context) {
	var req struct {
		Blocks     []pdf_exporter.Block `json:"blocks"`
		Wires      []pdf_exporter.Wire  `json:"wires"`
		Variables  []pdf_exporter.Variable `json:"variables"`
		Title      string               `json:"title"`
		Author     string               `json:"author"`
		Description string              `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := pdf_exporter.ExportConfig{
		Title:       req.Title,
		Author:      req.Author,
		Description: req.Description,
		PageSize:    "A4",
		Orientation: "P",
		IncludeDate: true,
	}

	data := pdf_exporter.FBDDiagramData{
		Blocks:    req.Blocks,
		Wires:     req.Wires,
		Variables: req.Variables,
	}

	result, err := pdf_exporter.ExportFBDToPDF(data, config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", "attachment; filename=\""+result.Filename+"\"")
	c.Data(http.StatusOK, "application/pdf", result.Data)
}
