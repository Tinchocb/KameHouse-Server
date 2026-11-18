package handlers

import (
	"context"
	"errors"
	"fmt"
	"github.com/rs/zerolog"
	"io/fs"
	"kamehouse/internal/core"
	"kamehouse/internal/util"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func doLimited(e *echo.Echo, mw echo.HandlerFunc, path, remoteAddr string) int {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = remoteAddr
	rec := httptest.NewRecorder()
	_ = mw(e.NewContext(req, rec))
	return rec.Code
}

func isolateRateLimitIPs(t *testing.T, ips ...string) {
	t.Helper()
	reset := func() {
		for _, ip := range ips {
			authBudgets.Remove(ip)
			limitersCache.Remove("api:" + ip)
		}
	}
	reset()
	t.Cleanup(reset)
}

func TestAuthRateLimit_PerIPAndNotSpoofable(t *testing.T) {
	isolateRateLimitIPs(t, "198.51.100.10", "198.51.100.11")
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	mw := func(c echo.Context) error {
		_, err := authorizeWithRateLimit(c, func() bool { return false })
		if err != nil || c.Response().Committed {
			return err
		}
		return c.NoContent(http.StatusUnauthorized)
	}

	ip := "198.51.100.10:5000"
	for i := 0; i < authRateBurst; i++ {
		if code := doLimited(e, mw, "/api/v1/settings", ip); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d within burst got %d", i+1, code)
		}
	}
	if code := doLimited(e, mw, "/api/v1/settings", ip); code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after burst, got %d", code)
	}

	// X-Forwarded-For no abre un cupo nuevo.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil)
	req.RemoteAddr = ip
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	rec := httptest.NewRecorder()
	_ = mw(e.NewContext(req, rec))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("spoofed X-Forwarded-For must not bypass the limit, got %d", rec.Code)
	}

	// Otra IP tiene su propio cupo.
	if code := doLimited(e, mw, "/api/v1/settings", "198.51.100.11:5000"); code != http.StatusUnauthorized {
		t.Fatalf("other IP should not be limited, got %d", code)
	}
}

func TestAPIRateLimit_LoopbackExemptRemoteCapped(t *testing.T) {
	isolateRateLimitIPs(t, "198.51.100.20")
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	mw := rateLimitMiddleware(func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	for i := 0; i < apiRateBurst+50; i++ {
		if code := doLimited(e, mw, "/api/v1/library/collection", "127.0.0.1:6000"); code != http.StatusOK {
			t.Fatalf("loopback must be exempt, got %d at request %d", code, i+1)
		}
	}

	remote := "198.51.100.20:6000"
	limited := false
	for i := 0; i < apiRateBurst+50; i++ {
		if doLimited(e, mw, "/api/v1/library/collection", remote) == http.StatusTooManyRequests {
			limited = true
			break
		}
	}
	if !limited {
		t.Fatal("remote client should hit the API rate limit")
	}
}

func TestRealAuthPathsShareFailureBudgetAndValidTrafficDoesNotConsumeIt(t *testing.T) {
	isolateRateLimitIPs(t, "127.0.0.42")
	l := zerolog.Nop()
	cfg := &core.Config{}
	cfg.Server.Password = "secret"
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Config: cfg, Logger: &l}, ServerPasswordSHA256: util.HashSHA256Hex("secret")}}
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	e.GET("/api/v1/settings", func(c echo.Context) error { return c.NoContent(http.StatusOK) }, h.OptionalAuthMiddleware)
	e.GET("/api/v1/status", func(c echo.Context) error { return c.NoContent(http.StatusOK) }, h.OptionalAuthMiddleware)
	e.GET("/api/v1/ws", h.webSocketEventHandler)
	request := func(path, token string) int {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "127.0.0.42:5010"
		req.Header.Set("X-KameHouse-Token", token)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		return rec.Code
	}
	for range 30 {
		if code := request("/api/v1/settings", "secret"); code != 200 {
			t.Fatalf("valid traffic limited: %d", code)
		}
	}
	paths := []string{"/api/v1/settings", "/api/v1/status", "/api/v1/ws"}
	for i := range authRateBurst {
		code := request(paths[i%len(paths)], "wrong")
		if code == 429 {
			t.Fatal("budget exhausted early")
		}
	}
	for _, path := range paths {
		if code := request(path, "wrong"); code != 429 {
			t.Fatalf("%s bypassed failure budget: %d", path, code)
		}
	}
}

func TestConcurrentGuessesCannotReuseRemainingAuthBudget(t *testing.T) {
	isolateRateLimitIPs(t, "127.0.0.43")
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	var validated atomic.Int32
	var wg sync.WaitGroup
	for range 64 {
		wg.Go(func() {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil)
			req.RemoteAddr = "127.0.0.43:5050"
			c := e.NewContext(req, httptest.NewRecorder())
			_, _ = authorizeWithRateLimit(c, func() bool { validated.Add(1); return false })
		})
	}
	wg.Wait()
	if n := validated.Load(); n != authRateBurst {
		t.Fatalf("validated %d guesses, want %d", n, authRateBurst)
	}
}

func TestErrorStatusCode_Typed(t *testing.T) {
	cases := []struct {
		err  error
		code int
	}{
		{fmt.Errorf("load: %w", gorm.ErrRecordNotFound), 404},
		{fmt.Errorf("open: %w", fs.ErrNotExist), 404},
		{fmt.Errorf("open: %w", fs.ErrPermission), 403},
		{fmt.Errorf("probe: %w", context.DeadlineExceeded), 504},
		{echo.NewHTTPError(http.StatusConflict, "busy"), 409},
	}
	for _, tc := range cases {
		if code, ok := errorStatusCode(tc.err); !ok || code != tc.code {
			t.Errorf("errorStatusCode(%v) = %d,%v; want %d", tc.err, code, ok, tc.code)
		}
	}
	if _, ok := errorStatusCode(errors.New("something invalid")); ok {
		t.Error("untyped errors must fall through to the text matcher")
	}
}
