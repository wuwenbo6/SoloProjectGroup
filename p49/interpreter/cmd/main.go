package main

import (
	"log"
	"os"

	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/server"
)

func main() {
	addr := ":8080"
	if len(os.Args) > 1 {
		addr = os.Args[1]
	}

	srv := server.NewServer()

	if len(os.Args) > 2 {
		content, err := os.ReadFile(os.Args[2])
		if err != nil {
			log.Printf("Warning: Could not read DSL file: %v", err)
		} else {
			if err := srv.LoadDSL(string(content)); err != nil {
				log.Printf("Warning: Could not load DSL: %v", err)
			}
		}
	}

	log.Fatal(srv.Start(addr))
}
