package api

import (
	"github.com/gin-gonic/gin"
	"github.com/video-transcoder/internal/storage"
)

func SetupRouter(minioClient *storage.MinIOClient) *gin.Engine {
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handler := NewHandler(minioClient)

	api := r.Group("/api")
	{
		api.GET("/health", handler.HealthCheck)

		api.POST("/upload", handler.UploadVideo)

		api.GET("/tasks", handler.ListTasks)
		api.GET("/tasks/:id", handler.GetTask)
		api.DELETE("/tasks/:id", handler.DeleteTask)

		api.POST("/tasks/:id/start", handler.StartTranscoding)
		api.GET("/tasks/:id/download", handler.DownloadOutput)
	}

	r.Static("/static", "./web/static")
	r.LoadHTMLGlob("web/templates/*")

	r.GET("/", func(c *gin.Context) {
		c.HTML(200, "index.html", nil)
	})

	return r
}
