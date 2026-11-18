package events

import (
	"context"
	"encoding/json"
	"kamehouse/internal/util"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"github.com/shirou/gopsutil/v4/process"
)

type WSEventManagerInterface interface {
	SendEvent(t string, payload interface{})
	SendEventTo(clientID string, t string, payload interface{}, noLog ...bool)
}

type (
	// WSEventManager holds the websocket connection instance.
	// It is attached to the App instance, so it is available to other handlers.
	WSEventManager struct {
		Conns  []*WSConn
		Logger *zerolog.Logger

		// ShutdownSignal is sent when the desktop sidecar monitor detects
		// a prolonged loss of WebSocket connections. The main goroutine should
		// listen on this channel and initiate graceful shutdown.
		ShutdownSignal chan struct{}

		// shutdownCtx is the context that signals application shutdown.
		// Used to gracefully stop background goroutines.
		shutdownCtx context.Context

		// hasHadConnection tracks if at least one WS connection was ever established.
		// Protected by connsMu.
		hasHadConnection bool

		// connsMu protects Conns and hasHadConnection.
		// Use RLock for reads, Lock for writes.
		connsMu   sync.RWMutex
		closed    bool
		closeOnce sync.Once

		dispatcher Dispatcher
	}

	WSConn struct {
		ID      string
		Conn    *websocket.Conn
		writeMu sync.Mutex
	}

	WSEventEnvelope struct {
		Type      string `json:"type"`
		Payload   any    `json:"payload"`
		Timestamp int64  `json:"timestamp"`
	}
)

var wsEventPool = sync.Pool{
	New: func() any {
		return &WSEventEnvelope{}
	},
}

// NewWSEventManager creates a new WSEventManager instance for App.
func NewWSEventManager(logger *zerolog.Logger, dispatcher Dispatcher, shutdownCtx context.Context) *WSEventManager {
	ret := &WSEventManager{
		Logger:         logger,
		Conns:          make([]*WSConn, 0),
		ShutdownSignal: make(chan struct{}, 1),
		dispatcher:     dispatcher,
		shutdownCtx:    shutdownCtx,
	}

	// Start bridging internal events to WebSockets
	if dispatcher != nil {
		go func() {
			defer util.HandlePanicInModuleThen("events/WSEventManager/Bridge", func() {})
			ch := dispatcher.Subscribe("*")
			defer dispatcher.Unsubscribe("*", ch)
			for {
				select {
				case <-ret.shutdownCtx.Done():
					return
				case e := <-ch:
					// Avoid loops: don't bridge events that might have originated from WS if they use the same topics
					// playback-heartbeat-progress se queda en servidor (telemetría interna):
					// republicarlo haría eco a todos los clientes cada 5s sin clientID.
					if e.Topic == "playback-heartbeat-progress" {
						continue
					}
					ret.SendEvent(e.Topic, e.Payload)
				}
			}
		}()
	}
	return ret
}

// Dispatcher returns the event dispatcher.
func (m *WSEventManager) Dispatcher() Dispatcher {
	return m.dispatcher
}

// ExitIfNoConnsAsDesktopSidecar watches the desktop host process when available.
// Legacy launchers fall back to shutting down after 60 seconds without WebSockets.
func (m *WSEventManager) ExitIfNoConnsAsDesktopSidecar() {
	// A renderer can disconnect during HMR, login, suspend or navigation while
	// its desktop host still owns the server. Watch that host instead of the UI.
	parentPID := int32(os.Getppid())
	if raw := os.Getenv("KAMEHOUSE_DESKTOP_PARENT_PID"); raw != "" {
		if pid, err := strconv.ParseInt(raw, 10, 32); err == nil && pid > 0 {
			parentPID = int32(pid)
		}
	}
	if parent, err := process.NewProcess(parentPID); err == nil {
		if name, err := parent.Name(); err == nil && strings.TrimSuffix(strings.ToLower(name), ".exe") == "kamehouse-desktop" {
			m.Logger.Info().Int32("pid", parentPID).Msg("desktop sidecar: Monitoring desktop host")
			go m.monitorDesktopHost(parent.IsRunning, 5*time.Second)
			return
		}
	}
	go func() {
		defer util.HandlePanicInModuleThen("events/ExitIfNoConnsAsDesktopSidecar", func() {})

		m.Logger.Info().Msg("ws: Monitoring connection as desktop sidecar")
		// Create a ticker to check connection every 5 seconds
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		// Track connection loss time
		var connectionLostTime time.Time
		exitTimeout := 60 * time.Second

		for {
			select {
			case <-m.shutdownCtx.Done():
				return
			case <-ticker.C:
			}
			// Check WebSocket connection status (protected read)
			m.connsMu.RLock()
			connsEmpty := len(m.Conns) == 0
			hadConn := m.hasHadConnection
			m.connsMu.RUnlock()

			if connsEmpty && hadConn {
				// If not connected and first detection of connection loss
				if connectionLostTime.IsZero() {
					m.Logger.Warn().Msg("ws: No connection detected. Starting countdown...")
					connectionLostTime = time.Now()
				}

				// Check if connection has been lost for more than exitTimeout
				if time.Since(connectionLostTime) > exitTimeout {
					m.Logger.Warn().Msg("ws: No connection detected for 60 seconds. Requesting shutdown...")
					// Signal shutdown instead of os.Exit to allow graceful cleanup
					select {
					case m.ShutdownSignal <- struct{}{}:
					default:
					}
					return
				}
			} else {
				// Connection is active, reset connection lost time
				connectionLostTime = time.Time{}
			}
		}
	}()
}

func (m *WSEventManager) monitorDesktopHost(isRunning func() (bool, error), interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-m.shutdownCtx.Done():
			return
		case <-ticker.C:
			running, err := isRunning()
			// An inspection failure is not proof that the host exited.
			if err == nil && !running {
				m.Logger.Info().Msg("desktop sidecar: Desktop host exited, requesting shutdown")
				m.TriggerShutdown()
				return
			}
		}
	}
}

// TriggerShutdown signals the server to initiate graceful shutdown immediately.
func (m *WSEventManager) TriggerShutdown() {
	if m != nil && m.ShutdownSignal != nil {
		select {
		case m.ShutdownSignal <- struct{}{}:
		default:
		}
	}
}

// AddConn registers a new websocket connection.
func (m *WSEventManager) AddConn(id string, conn *websocket.Conn) {
	m.connsMu.Lock()
	if m.closed || (m.shutdownCtx != nil && m.shutdownCtx.Err() != nil) {
		m.connsMu.Unlock()
		_ = conn.Close()
		return
	}
	var oldConn *WSConn
	for i, c := range m.Conns {
		if c.ID == id {
			oldConn = c
			m.Conns = append(m.Conns[:i], m.Conns[i+1:]...)
			break
		}
	}
	m.hasHadConnection = true
	m.Conns = append(m.Conns, &WSConn{
		ID:   id,
		Conn: conn,
	})
	m.connsMu.Unlock()

	if oldConn != nil {
		_ = oldConn.Conn.Close()
	}
}

// Close releases hijacked WebSocket connections, which http.Server.Shutdown
// does not close. It also rejects upgrades that finish after shutdown starts.
// Closing the transport unblocks readers and writers without acquiring writeMu.
func (m *WSEventManager) Close() {
	m.closeOnce.Do(func() {
		m.connsMu.Lock()
		m.closed = true
		conns := m.Conns
		m.Conns = nil
		m.connsMu.Unlock()
		for _, conn := range conns {
			_ = conn.Conn.Close()
		}
	})
}

// RemoveConnIfSame quita y cierra la conexion registrada bajo id solo si sigue siendo conn.
// Un cliente que reconecta con el mismo id reemplaza (y cierra) la anterior en AddConn: el
// handler viejo, al fallar su lectura, o un envio fallido sobre ella no deben sacar ni
// cerrar la conexion nueva que ahora lleva ese id.
func (m *WSEventManager) RemoveConnIfSame(id string, conn *websocket.Conn) {
	m.connsMu.Lock()
	var connToClose *WSConn
	for i, c := range m.Conns {
		if c.ID == id && c.Conn == conn {
			connToClose = c
			m.Conns = append(m.Conns[:i], m.Conns[i+1:]...)
			break
		}
	}
	m.connsMu.Unlock()

	if connToClose != nil {
		_ = connToClose.Conn.Close()
	}
}

// WritePong writes a pong control frame safely synchronized with writeMu.
func (m *WSEventManager) WritePong(id string, appData string, deadline time.Time) error {
	m.connsMu.RLock()
	var targetConn *WSConn
	for _, conn := range m.Conns {
		if conn.ID == id {
			targetConn = conn
			break
		}
	}
	m.connsMu.RUnlock()

	if targetConn == nil {
		return nil
	}

	targetConn.writeMu.Lock()
	defer targetConn.writeMu.Unlock()
	return targetConn.Conn.WriteControl(websocket.PongMessage, []byte(appData), deadline)
}

// SendEvent sends a websocket event to all connected clients.
func (m *WSEventManager) SendEvent(t string, payload interface{}) {
	m.connsMu.RLock()
	if len(m.Conns) == 0 {
		m.connsMu.RUnlock()
		return
	}

	if t != PlaybackManagerProgressPlaybackState && payload == nil {
		m.Logger.Trace().Str("type", t).Msg("ws: Sending message")
	}

	// Snapshot the connection list to avoid holding the lock during I/O
	conns := make([]*WSConn, len(m.Conns))
	copy(conns, m.Conns)
	m.connsMu.RUnlock()

	env := wsEventPool.Get().(*WSEventEnvelope)
	env.Type = t
	env.Payload = payload
	env.Timestamp = time.Now().UnixMilli()

	defer func() {
		env.Payload = nil // Reset for GC
		wsEventPool.Put(env)
	}()

	data, err := json.Marshal(env)
	if err != nil {
		return
	}

	var deadConnsMu sync.Mutex
	var deadConns []*WSConn

	writeConn := func(c *WSConn) {
		c.writeMu.Lock()
		defer c.writeMu.Unlock()
		defer func() {
			if r := recover(); r != nil {
				m.Logger.Error().Interface("panic", r).Msg("ws: Recovered from panic in SendEvent write (possibly closed websocket)")
				deadConnsMu.Lock()
				deadConns = append(deadConns, c)
				deadConnsMu.Unlock()
			}
		}()
		_ = c.Conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
			deadConnsMu.Lock()
			deadConns = append(deadConns, c)
			deadConnsMu.Unlock()
		}
	}

	if len(conns) <= 4 {
		// Fast path for local / small setups: write sequentially without goroutine allocation overhead
		for _, conn := range conns {
			writeConn(conn)
		}
	} else {
		var wg sync.WaitGroup
		for _, conn := range conns {
			c := conn
			wg.Add(1)
			go func() {
				defer wg.Done()
				writeConn(c)
			}()
		}
		wg.Wait()
	}

	for _, dead := range deadConns {
		m.RemoveConnIfSame(dead.ID, dead.Conn)
	}
}

// SendEventTo sends a websocket event to the specified client.
func (m *WSEventManager) SendEventTo(clientID string, t string, payload interface{}, noLog ...bool) {
	m.connsMu.RLock()
	var targetConn *WSConn
	for _, conn := range m.Conns {
		if conn.ID == clientID {
			targetConn = conn
			break
		}
	}
	m.connsMu.RUnlock()

	if targetConn == nil {
		return
	}

	if len(noLog) == 0 || !noLog[0] {
		m.Logger.Trace().Str("type", t).Str("clientId", clientID).Msg("ws: Sending message to client")
	}

	env := wsEventPool.Get().(*WSEventEnvelope)
	env.Type = t
	env.Payload = payload
	env.Timestamp = time.Now().UnixMilli()

	defer func() {
		env.Payload = nil // Reset for GC
		wsEventPool.Put(env)
	}()

	data, err := json.Marshal(env)
	if err != nil {
		return
	}

	targetConn.writeMu.Lock()
	defer targetConn.writeMu.Unlock()
	_ = targetConn.Conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	if err := targetConn.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
		go m.RemoveConnIfSame(clientID, targetConn.Conn)
	}
}
