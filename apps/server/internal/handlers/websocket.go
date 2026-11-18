package handlers

import (
	"kamehouse/internal/events"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/goccy/go-json"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// webSocketEventHandler creates a new websocket handler for real-time event communication.
// The route is registered BEFORE the auth middleware group so the HTTP→WS upgrade
// is never blocked by a missing Authorization header (browsers can't send one during WS connect).
// Clients can authenticate via:
//   - ?token=<value> query parameter (legacy)
//   - Authorization: Bearer <token> header (preferred)
//   - Sec-WebSocket-Protocol header with token (preferred for browsers)
//
// wsMaxClientMessageBytes es el tamaño máximo de un mensaje que un cliente puede enviar.
const wsMaxClientMessageBytes = 1 << 20 // 1 MiB

func (h *Handler) webSocketEventHandler(c echo.Context) error {
	// Reject browser origins before authentication: a foreign web page must
	// not consume the failure budget shared by legitimate localhost clients.
	if !h.isAllowedWebSocketOrigin(c.Request()) {
		return echo.NewHTTPError(http.StatusForbidden, "origin not allowed")
	}
	// Client identity — passed as query parameters since WS browsers can't set custom headers.
	id := c.QueryParam("id")
	if id == "" || id == "0" {
		id = uuid.New().String()
	}

	// Extract token from multiple sources (priority: header > query param)
	token := extractWSToken(c.Request())

	if h.App.Config.Server.Password != "" {
		isAuthed, err := authorizeWithRateLimit(c, func() bool {
			if h.isCorrectPasswordToken(token) {
				return true
			}
			if h.sessionWSRequest(c.Request(), token) {
				return true
			}
			if token == "" {
				return false
			}
			hmacAuth := h.App.GetServerPasswordHMACAuth()
			if claims, errHmac := hmacAuth.ValidateToken(token, c.Request().URL.Path); errHmac == nil && claims.Endpoint != "*" { // el token comodín de streaming no abre el WebSocket
				return true
			}
			return false
		})
		if err != nil || c.Response().Committed {
			return err
		}
		if !isAuthed {
			h.App.Logger.Warn().Str("id", id).Msg("ws: Unauthorized WebSocket connection attempt rejected")
			return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
		}
	}

	var upgrader = websocket.Upgrader{
		CheckOrigin: h.isAllowedWebSocketOrigin,
	}

	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()
	// Sin tope, gorilla acepta mensajes de cualquier tamaño: un solo cliente podía agotar
	// la memoria del servidor. Lo que envía la interfaz (ping, reclamo de pestaña,
	// eventos del reproductor) pesa unos pocos KB. Al pasarse, la conexión se cierra.
	ws.SetReadLimit(wsMaxClientMessageBytes)

	logCtx := h.App.Logger.Debug().Str("id", id)
	if token != "" {
		logCtx = logCtx.Str("tokenLen", strconv.Itoa(len(token)))
	}
	logCtx.Msg("ws: Client connected")

	// Add connection to manager
	h.App.WSEventManager.AddConn(id, ws)

	// Set handlers to reset read deadline upon receiving control frames
	ws.SetPingHandler(func(appData string) error {
		_ = ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		return h.App.WSEventManager.WritePong(id, appData, time.Now().Add(5*time.Second))
	})
	ws.SetPongHandler(func(string) error {
		_ = ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		// Strict drop policy: Reap the goroutine if client vanishes without closing TCP socket
		_ = ws.SetReadDeadline(time.Now().Add(60 * time.Second)) // si falla, ReadMessage devuelve el error
		_, msg, err := ws.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				h.App.Logger.Debug().Str("id", id).Msg("ws: Client disconnected")
			} else {
				h.App.Logger.Debug().Str("id", id).Msg("ws: Client disconnection")
			}
			h.App.WSEventManager.RemoveConnIfSame(id, ws)
			break
		}

		event, err := UnmarshalWebsocketClientEvent(msg)
		if err != nil {
			h.App.Logger.Error().Err(err).Msg("ws: Failed to unmarshal message sent from webview")
			continue
		}

		// Handle ping messages
		if event.Type == "ping" {
			timestamp := int64(0)
			if payload, ok := event.Payload.(map[string]interface{}); ok {
				if ts, ok := payload["timestamp"]; ok {
					if tsFloat, ok := ts.(float64); ok {
						timestamp = int64(tsFloat)
					} else if tsInt, ok := ts.(int64); ok {
						timestamp = tsInt
					}
				}
			}

			// Send pong response back to the same client
			h.App.WSEventManager.SendEventTo(event.ClientID, "pong", map[string]int64{"timestamp": timestamp})
			continue // Skip further processing for ping messages
		}

		// Handle main-tab-claim messages by broadcasting to all clients
		if event.Type == "main-tab-claim" {
			h.App.WSEventManager.SendEvent("main-tab-claim", event.Payload)
			continue
		}

		h.HandleClientEvents(event)
	}

	return nil
}

func (h *Handler) isAllowedWebSocketOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	for _, allowed := range h.App.Config.Server.CorsOrigins {
		if origin == allowed {
			return true
		}
	}
	// Reuse the HTTP guard's loopback/local-host rules. Matching an arbitrary
	// public Host is insufficient: DNS rebinding can supply that Host locally.
	if isTrustedWriteOrigin(origin, r, nil) {
		return true
	}
	h.App.Logger.Warn().Str("origin", origin).Str("host", r.Host).Msg("ws: rejected origin")
	return false
}

func UnmarshalWebsocketClientEvent(msg []byte) (*events.WebsocketClientEvent, error) {
	var event events.WebsocketClientEvent
	if err := json.Unmarshal(msg, &event); err != nil {
		return nil, err
	}
	return &event, nil
}

// extractWSToken extracts the authentication token from a WebSocket request.
// Priority: Authorization header > Sec-WebSocket-Protocol > query parameter.
func extractWSToken(r *http.Request) string {
	// 1. Authorization: Bearer <token>
	if auth := r.Header.Get("Authorization"); auth != "" {
		if strings.HasPrefix(auth, "Bearer ") {
			return strings.TrimPrefix(auth, "Bearer ")
		}
	}

	// 2. Sec-WebSocket-Protocol header (for browsers that can't set Authorization on WS upgrade)
	if proto := r.Header.Get("Sec-WebSocket-Protocol"); proto != "" {
		// Format: "kamehouse.token.<token>" or just "<token>"
		if strings.HasPrefix(proto, "kamehouse.token.") {
			return strings.TrimPrefix(proto, "kamehouse.token.")
		}
		// If it looks like a token (long enough), use it
		if len(proto) > 20 {
			return proto
		}
	}

	// 3. Query parameter (legacy fallback)
	return r.URL.Query().Get("token")
}
