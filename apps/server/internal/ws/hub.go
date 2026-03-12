package ws

import (
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// WSEvent represents the payload sent to clients
type WSEvent struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// Client represents a connected WebSocket client
type Client struct {
	conn *websocket.Conn
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]bool
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity/local dev
	},
}

// NewHub creates a new WebSocket Hub
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
	}
}

// AddClient safely registers a new client
func (h *Hub) AddClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

// RemoveClient safely unregisters a client and closes its connection
func (h *Hub) RemoveClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[c]; ok {
		delete(h.clients, c)
		_ = c.conn.Close()
	}
}

// Broadcast sends a JSON message to all connected clients
func (h *Hub) Broadcast(eventType string, payload any) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	event := WSEvent{
		Type:    eventType,
		Payload: payload,
	}

	for client := range h.clients {
		_ = client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		err := client.conn.WriteJSON(event)
		if err != nil {
			// Cannot RemoveClient here since we hold RLock.
			// Run cleanup asynchronously to avoid deadlock.
			go h.RemoveClient(client)
		}
	}
}

// ServeWS handles WebSocket upgrade requests from Echo
func (h *Hub) ServeWS(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	client := &Client{conn: conn}
	h.AddClient(client)

	defer h.RemoveClient(client)

	// Keep connection alive and read incoming messages (if any)
	// Even if we don't expect messages, we must read to process ping/pong/close natively.
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}

	return nil
}
