package handlers

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"kamehouse/internal/events"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

func startWSServer(t *testing.T) (*websocket.Conn, string) {
	t.Helper()
	app, _ := setupTestApp(t)
	l := zerolog.Nop()
	app.Logger = &l
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	app.WSEventManager = events.NewWSEventManager(&l, nil, ctx)

	h := &Handler{App: app}
	e := echo.New()
	e.GET("/ws", h.webSocketEventHandler)
	srv := httptest.NewServer(e)
	t.Cleanup(srv.Close)

	const id = "cliente-de-prueba"
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?id="+id, nil)
	if err != nil {
		t.Fatalf("no se pudo abrir el WebSocket: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn, id
}

func TestWebSocketSigueAtendiendoMensajesNormales(t *testing.T) {
	conn, id := startWSServer(t)

	ping, _ := json.Marshal(map[string]any{"clientID": id, "type": "ping", "payload": map[string]any{"timestamp": 42}})
	if err := conn.WriteMessage(websocket.TextMessage, ping); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("se esperaba el pong: %v", err)
	}
	if !strings.Contains(string(msg), `"pong"`) {
		t.Errorf("respuesta inesperada: %s", msg)
	}
}

// Un mensaje de más de wsMaxClientMessageBytes cierra la conexión en vez de cargarse en memoria.
func TestWebSocketCierraLaConexionConUnMensajeEnorme(t *testing.T) {
	conn, _ := startWSServer(t)

	huge := strings.Repeat("a", wsMaxClientMessageBytes+1024)
	_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"x","payload":"`+huge+`"}`))

	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("la conexión debía cerrarse")
	}
	if !websocket.IsCloseError(err, websocket.CloseMessageTooBig) {
		t.Errorf("se esperaba el cierre 1009 (mensaje demasiado grande), obtuve: %v", err)
	}
}
