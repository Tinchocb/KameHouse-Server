package main

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

func TestShutdownHTTPServerClosesConnectionsAfterDeadline(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	started, stopped := make(chan struct{}), make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-r.Context().Done(); close(stopped) })}
	defer srv.Close()
	go srv.Serve(listener)
	response := make(chan struct{})
	go func() {
		defer close(response)
		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get("http://" + listener.Addr().String())
		if err == nil {
			resp.Body.Close()
		}
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("handler did not start")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	logger := zerolog.Nop()
	shutdownHTTPServer(ctx, srv, &logger)
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("connection was not closed after drain timed out")
	}
	select {
	case <-response:
	case <-time.After(time.Second):
		t.Fatal("request remained open")
	}
}
