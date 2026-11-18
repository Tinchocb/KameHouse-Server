package events

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

func shutdownSocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	t.Helper()
	accepted := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err == nil {
			accepted <- conn
		}
	}))
	t.Cleanup(server.Close)
	client, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	select {
	case conn := <-accepted:
		t.Cleanup(func() { _ = conn.Close() })
		return conn, client
	case <-time.After(3 * time.Second):
		t.Fatal("websocket not accepted")
		return nil, nil
	}
}

func assertShutdownSocketClosed(t *testing.T, client *websocket.Conn) {
	t.Helper()
	_ = client.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, _, err := client.ReadMessage()
	if err == nil {
		t.Fatal("connection remained open")
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		t.Fatal("connection timed out instead of closing")
	}
}

func TestWebSocketCloseUnblocksInactiveClientWithoutWriterLock(t *testing.T) {
	logger := zerolog.Nop()
	m := NewWSEventManager(&logger, nil, context.Background())
	conn, client := shutdownSocketPair(t)
	m.AddConn("inactive", conn)
	m.Conns[0].writeMu.Lock()
	defer m.Conns[0].writeMu.Unlock()
	done := make(chan struct{})
	go func() {
		var wg sync.WaitGroup
		for range 12 {
			wg.Add(1)
			go func() { defer wg.Done(); m.Close() }()
		}
		wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("close blocked behind writer or concurrent close")
	}
	assertShutdownSocketClosed(t, client)
	if len(m.Conns) != 0 {
		t.Fatal("closed connections retained")
	}
}

func TestWebSocketRegistrationRejectedAfterShutdown(t *testing.T) {
	for _, canceled := range []bool{false, true} {
		t.Run(fmt.Sprintf("contextCanceled=%v", canceled), func(t *testing.T) {
			logger := zerolog.Nop()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			m := NewWSEventManager(&logger, nil, ctx)
			if canceled {
				cancel()
			} else {
				m.Close()
			}
			conn, client := shutdownSocketPair(t)
			m.AddConn("late", conn)
			if len(m.Conns) != 0 {
				t.Fatal("late connection admitted")
			}
			assertShutdownSocketClosed(t, client)
		})
	}
}

func TestWebSocketCloseRacesWithRegistration(t *testing.T) {
	logger := zerolog.Nop()
	m := NewWSEventManager(&logger, nil, context.Background())
	var wg sync.WaitGroup
	start := make(chan struct{})
	clients := make([]*websocket.Conn, 0, 12)
	for i := range 12 {
		conn, client := shutdownSocketPair(t)
		clients = append(clients, client)
		wg.Add(1)
		go func() { defer wg.Done(); <-start; m.AddConn(fmt.Sprint(i), conn) }()
	}
	wg.Add(1)
	go func() { defer wg.Done(); <-start; m.Close() }()
	close(start)
	wg.Wait()
	if len(m.Conns) != 0 {
		t.Fatal("registration survived close")
	}
	for _, client := range clients {
		assertShutdownSocketClosed(t, client)
	}
}
