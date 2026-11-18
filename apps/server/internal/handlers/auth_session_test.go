package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/core"
	"kamehouse/internal/events"
	"kamehouse/internal/util"
)

func sessionFixture(t *testing.T) (*Handler, *echo.Echo) {
	t.Helper()
	isolateRateLimitIPs(t, "127.0.0.1", "192.0.2.61")
	logger := zerolog.Nop()
	cfg := &core.Config{}
	cfg.Server.Password = "fixture-password"
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Config: cfg, Logger: &logger}, ServerPasswordSHA256: util.HashSHA256Hex(cfg.Server.Password), ServerPasswordHash: "fixture-hmac-secret"}}
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	h.App.WSEventManager = events.NewWSEventManager(&logger, nil, ctx)
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	v1 := e.Group("/api/v1", h.OptionalAuthMiddleware)
	h.RegisterAuthRoutes(v1)
	v1.POST("/shutdown", func(c echo.Context) error { return c.NoContent(204) })
	v1.GET("/video-storyboard", func(c echo.Context) error { return c.String(200, "image") })
	e.GET("/api/v1/ws", h.webSocketEventHandler)
	return h, e
}

func TestSessionExchangeHTTPAndWebSocket(t *testing.T) {
	h, e := sessionFixture(t)
	srv := httptest.NewServer(e)
	defer srv.Close()
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/auth/session", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer fixture-password")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, 200, resp.StatusCode)
	require.Equal(t, "no-store", resp.Header.Get("Cache-Control"))
	var payload struct {
		Data struct {
			SessionToken string `json:"sessionToken"`
			StreamToken  string `json:"streamToken"`
			ExpiresAt    int64  `json:"expiresAt"`
		} `json:"data"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))
	require.Greater(t, payload.Data.ExpiresAt, time.Now().Add(11*time.Hour).Unix())
	require.True(t, h.isAPISessionToken(payload.Data.SessionToken))
	require.False(t, h.isAPISessionToken(payload.Data.StreamToken))

	request := func(method, path, header string) int {
		r, _ := http.NewRequest(method, srv.URL+path, nil)
		if header != "" {
			r.Header.Set("Authorization", "Bearer "+header)
		}
		response, callErr := http.DefaultClient.Do(r)
		require.NoError(t, callErr)
		_, _ = io.Copy(io.Discard, response.Body)
		response.Body.Close()
		return response.StatusCode
	}
	// A full session authorizes writes only through the header, while the
	// resource URL credential can read media but cannot become an API session.
	require.Equal(t, 204, request("POST", "/api/v1/shutdown", payload.Data.SessionToken))
	require.Equal(t, 200, request("GET", "/api/v1/video-storyboard?token="+payload.Data.StreamToken, ""))
	require.Equal(t, 401, request("POST", "/api/v1/shutdown?token="+payload.Data.StreamToken, ""))
	require.Equal(t, 401, request("GET", "/api/v1/auth/session?token="+payload.Data.SessionToken, ""))
	require.Equal(t, 401, request("GET", "/api/v1/auth/session", payload.Data.StreamToken))

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/api/v1/ws?id=session-test"
	dialer := websocket.Dialer{Subprotocols: []string{"kamehouse.token." + payload.Data.SessionToken}}
	conn, _, err := dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	conn.Close()
	// Reconnect uses the same bounded credential without a password roundtrip.
	conn, _, err = dialer.Dial(wsURL, nil)
	require.NoError(t, err)
	conn.Close()

	// A harmless protocol header cannot launder a full session from a URL.
	for _, header := range []http.Header{nil, {"Sec-WebSocket-Protocol": {"innocent"}}} {
		req := httptest.NewRequest("GET", "/api/v1/ws?token="+payload.Data.SessionToken, nil)
		req.Header = header
		require.False(t, h.sessionWSRequest(req, extractWSToken(req)))
	}
	expired, err := h.App.GetServerPasswordHMACAuth().GenerateTokenWithTTL(apiSessionPurpose, -time.Minute)
	require.NoError(t, err)
	require.False(t, h.isAPISessionToken(expired))
	require.False(t, h.isValidHMACToken(payload.Data.StreamToken, "POST", "/api/v1/auth/session"))

	// The stream credential remains valid after the former five-minute cutoff.
	claims, err := h.App.GetServerPasswordHMACAuth().ValidateToken(payload.Data.StreamToken, "/api/v1/video-storyboard")
	require.NoError(t, err)
	require.GreaterOrEqual(t, claims.ExpiresAt-claims.IssuedAt, int64((11 * time.Hour).Seconds()))
}

func TestSessionLoginUsesAuthenticationFailureBudget(t *testing.T) {
	_, e := sessionFixture(t)
	for i := 0; i < authRateBurst+1; i++ {
		req := httptest.NewRequest("GET", "/api/v1/auth/session", nil)
		req.RemoteAddr = "192.0.2.61:4321"
		req.Header.Set("Authorization", "Bearer incorrect")
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if i < authRateBurst {
			require.Equal(t, 401, rec.Code)
		} else {
			require.Equal(t, 429, rec.Code)
			require.NotEmpty(t, rec.Header().Get("Retry-After"))
		}
	}
}

func TestAPISessionHonorsConfiguredTTLWithoutShorteningPlayback(t *testing.T) {
	h, e := sessionFixture(t)
	h.App.Config.Server.AuthTokenTTL = "5m"
	req := httptest.NewRequest("GET", "/api/v1/auth/session", nil)
	req.RemoteAddr = "192.0.2.61:4321"
	req.Header.Set("Authorization", "Bearer fixture-password")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, 200, rec.Code)
	var body struct {
		Data struct {
			SessionToken string `json:"sessionToken"`
			StreamToken  string `json:"streamToken"`
			ExpiresAt    int64  `json:"expiresAt"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	api, err := h.App.GetServerPasswordHMACAuth().ValidateToken(body.Data.SessionToken, apiSessionPurpose)
	require.NoError(t, err)
	require.EqualValues(t, 300, api.ExpiresAt-api.IssuedAt)
	require.Equal(t, api.ExpiresAt, body.Data.ExpiresAt)
	stream, err := h.App.GetServerPasswordHMACAuth().ValidateToken(body.Data.StreamToken, "/api/v1/mediastream/hls/master.m3u8")
	require.NoError(t, err)
	require.EqualValues(t, 12*60*60, stream.ExpiresAt-stream.IssuedAt)
}
