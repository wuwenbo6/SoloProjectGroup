package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type WsMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Client struct {
	conn *websocket.Conn
	send chan WsMessage
}

var (
	clients   = make(map[*Client]bool)
	clientsMu sync.RWMutex
	Broadcast = make(chan WsMessage, 100)
)

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[WebSocket] Upgrade error:", err)
		return
	}

	client := &Client{
		conn: conn,
		send: make(chan WsMessage, 256),
	}

	clientsMu.Lock()
	clients[client] = true
	clientsMu.Unlock()

	log.Println("[WebSocket] New client connected, total clients:", len(clients))

	go client.writePump()
	client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		clientsMu.Lock()
		delete(clients, c)
		clientsMu.Unlock()
		c.conn.Close()
		close(c.send)
		log.Println("[WebSocket] Client disconnected, remaining clients:", len(clients))
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WebSocket] Read error: %v", err)
			}
			break
		}

		var msg WsMessage
		if err := json.Unmarshal(message, &msg); err == nil && msg.Type == "ping" {
			select {
			case c.send <- WsMessage{Type: "pong"}:
			default:
			}
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				log.Println("[WebSocket] Write error:", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Println("[WebSocket] Ping error:", err)
				return
			}
		}
	}
}

func HandleMessages() {
	for msg := range Broadcast {
		clientsMu.RLock()
		for client := range clients {
			select {
			case client.send <- msg:
			default:
				log.Println("[WebSocket] Client send buffer full, dropping message")
			}
		}
		clientsMu.RUnlock()
	}
}

func BroadcastMessage(msgType string, data interface{}) {
	msg := WsMessage{
		Type: msgType,
		Data: data,
	}
	select {
	case Broadcast <- msg:
	default:
		log.Println("[WebSocket] Broadcast channel full, dropping message")
	}
}
