package handlers

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
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

func TestAuthRateLimit_PerIPAndNotSpoofable(t *testing.T) {
	e := echo.New()
	e.IPExtractor = echo.ExtractIPDirect()
	mw := authRateLimitMiddleware(func(c echo.Context) error { return c.NoContent(http.StatusOK) })

	ip := "198.51.100.10:5000"
	for i := 0; i < authRateBurst; i++ {
		if code := doLimited(e, mw, "/api/v1/auth/login", ip); code != http.StatusOK {
			t.Fatalf("attempt %d within burst got %d", i+1, code)
		}
	}
	if code := doLimited(e, mw, "/api/v1/auth/login", ip); code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after burst, got %d", code)
	}

	// X-Forwarded-For no abre un cupo nuevo.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/login", nil)
	req.RemoteAddr = ip
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	rec := httptest.NewRecorder()
	_ = mw(e.NewContext(req, rec))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("spoofed X-Forwarded-For must not bypass the limit, got %d", rec.Code)
	}

	// Otra IP tiene su propio cupo.
	if code := doLimited(e, mw, "/api/v1/auth/login", "198.51.100.11:5000"); code != http.StatusOK {
		t.Fatalf("other IP should not be limited, got %d", code)
	}
}

func TestAPIRateLimit_LoopbackExemptRemoteCapped(t *testing.T) {
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
