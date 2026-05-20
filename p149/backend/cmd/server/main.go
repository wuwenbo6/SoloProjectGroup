package main

import (
	"log"
	"net/http"
	"plc-simulator/internal/api"
	"plc-simulator/internal/engine"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化仿真引擎
	simEngine := engine.NewEngine()

	// 初始化PLC集群管理器
	api.InitPLCCluster()

	// 初始化数据库
	if err := api.InitDB("../data/plc.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 设置Gin路由
	r := gin.Default()

	// CORS配置
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 健康检查路由
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "plc-simulator",
			"engine": gin.H{
				"running": simEngine.IsRunning,
				"healthy": simEngine.IsHealthy(),
			},
		})
	})

	// API路由
	apiGroup := r.Group("/api")
	{
		// 项目管理
		apiGroup.GET("/projects", api.GetProjects)
		apiGroup.GET("/projects/:id", api.GetProject)
		apiGroup.POST("/projects", api.CreateProject)
		apiGroup.PUT("/projects/:id", api.UpdateProject)
		apiGroup.DELETE("/projects/:id", api.DeleteProject)

		// 引擎状态
		apiGroup.GET("/engine/health", func(c *gin.Context) {
			api.GetEngineHealth(c, simEngine)
		})

		// Modbus API
		modbusGroup := apiGroup.Group("/modbus")
		{
			modbusGroup.POST("/connect", api.ConnectModbus)
			modbusGroup.POST("/disconnect", api.DisconnectModbus)
			modbusGroup.GET("/status", api.GetModbusStatus)
			modbusGroup.POST("/read-coils", api.ReadCoils)
			modbusGroup.POST("/write-coil", api.WriteCoil)
			modbusGroup.POST("/read-registers", api.ReadRegisters)
			modbusGroup.POST("/write-register", api.WriteRegister)
		}

		// PLC集群API
		clusterGroup := apiGroup.Group("/cluster")
		{
			clusterGroup.GET("/state", api.GetClusterState)
			clusterGroup.POST("/plc", api.AddPLC)
			clusterGroup.DELETE("/plc/:id", api.RemovePLC)
			clusterGroup.POST("/start", api.StartCluster)
			clusterGroup.POST("/stop", api.StopCluster)
			clusterGroup.GET("/plc/:id/data", api.ReadPLCData)
			clusterGroup.POST("/plc/:id/data", api.WritePLCData)
			clusterGroup.POST("/plc/:id/test", api.TestPLCConnection)
		}

		// PDF导出API
		pdfGroup := apiGroup.Group("/pdf")
		{
			pdfGroup.POST("/export/ladder", api.ExportLadderToPDF)
			pdfGroup.POST("/export/fbd", api.ExportFBDToPDF)
		}
	}

	// WebSocket路由
	r.GET("/ws", func(c *gin.Context) {
		api.HandleWebSocket(c, simEngine)
	})

	// 启动服务器
	log.Println("PLC Simulator Server starting on :8080")
	if err := r.Run(":8080"); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}
