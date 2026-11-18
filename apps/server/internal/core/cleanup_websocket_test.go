package core

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"kamehouse/internal/events"
)

func TestCleanupClosesHijackedWebSockets(t *testing.T) {
	a := cleanupTestApp()
	a.WSEventManager = events.NewWSEventManager(a.Logger, nil, a.ShutdownCtx())
	registered, stopped := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		a.WSEventManager.AddConn("shutdown-test", conn)
		close(registered)
		defer close(stopped)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	defer server.Close()
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	select {
	case <-registered:
	case <-time.After(3 * time.Second):
		t.Fatal("websocket not registered")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	a.Cleanup(ctx)
	select {
	case <-stopped:
	case <-time.After(3 * time.Second):
		t.Fatal("cleanup left hijacked websocket handler reading")
	}
}
