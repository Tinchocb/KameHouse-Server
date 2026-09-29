package util

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProxySafeDialContext_BlocksInternalAddresses(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	defer srv.Close()

	// httptest escucha en 127.0.0.1: es justo lo que un redirect o un DNS
	// rebinding intentaría alcanzar.
	if conn, err := ProxySafeDialContext(context.Background(), "tcp", srv.Listener.Addr().String()); err == nil {
		conn.Close()
		t.Fatal("expected dial to loopback to be blocked")
	}

	for _, ip := range []string{"10.0.0.1", "192.168.1.1", "169.254.169.254", "::1", "0.0.0.0"} {
		if !isBlockedProxyIP(net.ParseIP(ip)) {
			t.Errorf("expected %s to be blocked", ip)
		}
	}
	for _, ip := range []string{"8.8.8.8", "151.101.1.1", "2606:4700::1111"} {
		if isBlockedProxyIP(net.ParseIP(ip)) {
			t.Errorf("expected %s to be allowed", ip)
		}
	}
}

func TestFilterProxyRequestHeaders(t *testing.T) {
	got := FilterProxyRequestHeaders(map[string]string{
		"referer":         "https://example.com/",
		"User-Agent":      "ua",
		"Host":            "127.0.0.1",
		"Authorization":   "Bearer x",
		"X-Forwarded-For": "127.0.0.1",
		"Origin":          "https://a\r\nX-Injected: 1",
	})
	if len(got) != 2 || got["Referer"] != "https://example.com/" || got["User-Agent"] != "ua" {
		t.Fatalf("unexpected filtered headers: %v", got)
	}
}
