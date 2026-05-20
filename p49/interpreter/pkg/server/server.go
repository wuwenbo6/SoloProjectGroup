package server

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/interpreter"
	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/parser"
	"github.com/wuwenbo/fsm-dsl/interpreter/pkg/types"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	interpreter *interpreter.Interpreter
	clients     map[*websocket.Conn]bool
	mu          sync.RWMutex
}

func NewServer() *Server {
	return &Server{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (s *Server) LoadDSL(content string) error {
	machine, err := parser.ParseDSL(content)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.interpreter != nil {
		s.interpreter.Stop()
	}

	s.interpreter = interpreter.NewInterpreter(machine)
	s.interpreter.SetOnStateChange(func(state *types.ExecutionState) {
		s.broadcastMessage("state", state)
	})
	s.interpreter.Start()

	return nil
}

func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	s.mu.Lock()
	s.clients[conn] = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
	}()

	if s.interpreter != nil {
		state := s.interpreter.GetExecutionState()
		s.sendMessage(conn, "state", state)
	}

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			break
		}

		s.handleMessage(message)
	}
}

func (s *Server) handleMessage(rawMessage []byte) {
	var msg types.WSMessage
	if err := json.Unmarshal(rawMessage, &msg); err != nil {
		log.Printf("Unmarshal error: %v", err)
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.interpreter == nil {
		return
	}

	switch msg.Type {
	case "event":
		if event, ok := msg.Payload.(string); ok {
			s.interpreter.SendEvent(event)
		}
	case "breakpoint":
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			return
		}
		state, _ := payload["state"].(string)
		enabled, _ := payload["enabled"].(bool)
		if enabled {
			s.interpreter.AddBreakpoint(state)
		} else {
			s.interpreter.RemoveBreakpoint(state)
		}
		stateUpdate := s.interpreter.GetExecutionState()
		s.broadcastMessage("state", stateUpdate)
	case "pause":
		s.interpreter.Pause()
	case "resume":
		s.interpreter.Resume()
	case "step":
		s.interpreter.Step()
	case "reset":
		s.interpreter.Reset()
	}
}

func (s *Server) sendMessage(conn *websocket.Conn, msgType string, payload interface{}) {
	msg := types.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Marshal error: %v", err)
		return
	}
	conn.WriteMessage(websocket.TextMessage, data)
}

func (s *Server) broadcastMessage(msgType string, payload interface{}) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	msg := types.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Marshal error: %v", err)
		return
	}

	for conn := range s.clients {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

func (s *Server) GetInterpreter() *interpreter.Interpreter {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.interpreter
}

func (s *Server) Start(addr string) error {
	http.HandleFunc("/ws", s.HandleWebSocket)
	http.HandleFunc("/load", s.handleLoadDSL)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("FSM DSL Interpreter Server"))
	})

	log.Printf("Server starting on %s", addr)
	return http.ListenAndServe(addr, nil)
}

func (s *Server) handleLoadDSL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.LoadDSL(req.Content); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
