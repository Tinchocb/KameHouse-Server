package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"kamehouse/internal/core"
	"kamehouse/internal/events"
	"kamehouse/internal/util"
)

func TestProductionOriginPolicyHTTPAndWebSocket(t *testing.T) {
	for _, password := range []string{"", "fixture-secret"} {
		name := "without-password"
		if password != "" {
			name = "with-password"
		}
		t.Run(name, func(t *testing.T) {
			for _, key := range []string{"KAMEHOUSE_DATA_DIR", "KAMEHOUSE_WORKING_DIR", "KAMEHOUSE_CORS_ALLOWED_ORIGINS", "KAMEHOUSE_DEV_CORS_ORIGINS", "KAMEHOUSE_ALLOW_LAN"} {
				t.Setenv(key, "")
			}
			t.Setenv("KAMEHOUSE_ENV", "production")
			isolateRateLimitIPs(t, "127.0.0.1")
			logger := zerolog.Nop()
			cfg, _, err := core.NewConfig(&core.ConfigOptions{Flags: core.KameHouseFlags{DataDir: t.TempDir(), Password: password}}, &logger)
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			app := &core.App{CoreServices: core.CoreServices{Config: cfg, Logger: &logger}, ServerPasswordSHA256: util.HashSHA256Hex(password)}
			app.WSEventManager = events.NewWSEventManager(&logger, nil, ctx)
			h := &Handler{App: app}
			e := echo.New()
			e.IPExtractor = echo.ExtractIPDirect()
			e.HTTPErrorHandler = CustomHTTPErrorHandler
			e.Use(corsMiddleware(cfg.Server.CorsOrigins))
			e.Use(crossOriginWriteGuard(cfg.Server.CorsOrigins))
			e.Use(rateLimitMiddleware)
			var mutations atomic.Int32
			e.POST("/api/v1/test-mutation", func(c echo.Context) error { mutations.Add(1); return c.NoContent(http.StatusOK) }, h.OptionalAuthMiddleware)
			e.GET("/api/v1/ws", h.webSocketEventHandler)
			srv := httptest.NewServer(e)
			defer srv.Close()
			client := &http.Client{Timeout: 3 * time.Second}
			// Foreign origins must be rejected before spending the localhost
			// authentication budget, otherwise a web page can lock out Tauri.
			for range authRateBurst + 1 {
				conn, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/api/v1/ws", http.Header{"Origin": {"https://evil.example"}})
				if err == nil {
					conn.Close()
					t.Fatal("foreign WS origin accepted")
				}
				if resp == nil || resp.StatusCode != http.StatusForbidden {
					t.Fatalf("foreign WS must fail before auth budget: %v, response=%v", err, resp)
				}
				resp.Body.Close()
			}
			rebindingURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"
			if password != "" {
				rebindingURL += "?token=" + password
			}
			conn, rebindingResp, err := websocket.DefaultDialer.Dial(rebindingURL, http.Header{"Origin": {"http://evil.example"}, "Host": {"evil.example"}})
			if err == nil {
				conn.Close()
				t.Fatal("WS accepted a public Host via loopback")
			}
			if rebindingResp == nil || rebindingResp.StatusCode != http.StatusForbidden {
				t.Fatalf("rebinding: %v", err)
			}
			rebindingResp.Body.Close()
			for _, origin := range []string{"null", "file://", "http://tauri.localhost", "https://evil.example"} {
				t.Run(origin, func(t *testing.T) {
					allowed := origin == "http://tauri.localhost" || (password != "" && (origin == "null" || origin == "file://"))
					preflight, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/v1/test-mutation", nil)
					preflight.Header.Set("Origin", origin)
					preflight.Header.Set("Access-Control-Request-Method", http.MethodPost)
					preflight.Header.Set("Access-Control-Request-Headers", "X-KameHouse-Token")
					resp, err := client.Do(preflight)
					if err != nil {
						t.Fatal(err)
					}
					resp.Body.Close()
					if got := resp.Header.Get("Access-Control-Allow-Origin") == origin; got != allowed {
						t.Fatalf("preflight accepted=%v, want %v", got, allowed)
					}

					before := mutations.Load()
					req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/test-mutation", nil)
					req.Header.Set("Origin", origin)
					if password != "" {
						req.Header.Set("X-KameHouse-Token", password)
					}
					resp, err = client.Do(req)
					if err != nil {
						t.Fatal(err)
					}
					resp.Body.Close()
					want := http.StatusForbidden
					if allowed {
						want = http.StatusOK
					}
					if resp.StatusCode != want {
						t.Fatalf("write status %d, want %d", resp.StatusCode, want)
					}
					if got := mutations.Load() - before; (got == 1) != allowed {
						t.Fatalf("write reached handler %d times, allowed=%v", got, allowed)
					}

					wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws"
					if password != "" {
						wsURL += "?token=" + password
					}
					conn, wsResp, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Origin": {origin}})
					if allowed {
						if err != nil {
							t.Fatalf("WS rejected: %v", err)
						}
						conn.Close()
					} else {
						if err == nil {
							conn.Close()
							t.Fatal("WS accepted untrusted origin")
						}
						if wsResp == nil || wsResp.StatusCode != http.StatusForbidden {
							t.Fatalf("WS rejected unexpectedly: %v", err)
						}
					}
					if wsResp != nil {
						wsResp.Body.Close()
					}
				})
			}
			if password != "" {
				conn, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/api/v1/ws", http.Header{"Origin": {"null"}})
				if err == nil {
					conn.Close()
					t.Fatal("opaque WS accepted without credentials")
				}
				if resp == nil || resp.StatusCode != http.StatusUnauthorized {
					t.Fatalf("unauthenticated WS: %v", err)
				}
				resp.Body.Close()
				// An accepted opaque origin still needs credentials, and rate-limit
				// responses must be readable by the TV client through CORS. WS has
				// already consumed one failure from the shared budget.
				for i := 1; i <= authRateBurst; i++ {
					req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/test-mutation", nil)
					req.Header.Set("Origin", "null")
					before := mutations.Load()
					resp, err := client.Do(req)
					if err != nil {
						t.Fatal(err)
					}
					resp.Body.Close()
					want := http.StatusUnauthorized
					if i == authRateBurst {
						want = http.StatusTooManyRequests
					}
					if resp.StatusCode != want || mutations.Load() != before {
						t.Fatalf("unauthenticated write: status=%d", resp.StatusCode)
					}
					if i == authRateBurst && (resp.Header.Get("Retry-After") != "5" || !strings.Contains(resp.Header.Get("Access-Control-Expose-Headers"), "Retry-After")) {
						t.Fatal("TV cannot observe retry delay")
					}
				}
			}
		})
	}
}
