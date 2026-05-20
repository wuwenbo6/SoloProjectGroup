package main

import (
	"log"
	"shadow-puppet-detection/internal/api"
	"shadow-puppet-detection/internal/repository"
)

func main() {
	repository.InitDatabase()

	go api.HandleMessages()

	r := api.SetupRouter()

	log.Println("Server starting on :8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
