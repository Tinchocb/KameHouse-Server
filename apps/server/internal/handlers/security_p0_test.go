package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

func setupTestApp(t *testing.T) (*core.App, string) {
	tempDir := t.TempDir()
	appDataDir := filepath.Join(tempDir, "appdata")
	logsDir := filepath.Join(tempDir, "logs")
	_ = os.MkdirAll(appDataDir, 0755)
	_ = os.MkdirAll(logsDir, 0755)

	l := zerolog.Nop()
	database, err := db.NewDatabase(context.Background(), appDataDir, "test_db", &l)
	if err != nil {
		t.Fatalf("failed to init test database: %v", err)
	}
	t.Cleanup(func() {
		database.Shutdown()
		_ = database.Close()
	})

	cfg := &core.Config{}
	cfg.Server.Password = ""
	cfg.Data.AppDataDir = appDataDir
	cfg.Logs.Dir = logsDir

	app := &core.App{
		CoreServices: core.CoreServices{
			Database: database,
			Config:   cfg,
		},
	}

	return app, tempDir
}

func TestOptionalAuthMiddleware_SensitiveEndpointsRestricted(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	mw := h.OptionalAuthMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	// 1. Remote request to sensitive endpoint with no password -> 403
	req := httptest.NewRequest(http.MethodGet, "/api/v1/memory/profile", nil)
	req.RemoteAddr = "192.168.1.50:12345"
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := mw(c)
	if err != nil {
		e.HTTPErrorHandler(err, c)
	}
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for remote unauthenticated request to sensitive endpoint, got %d", rec.Code)
	}

	// 2. Loopback request to sensitive endpoint with no password -> 200
	reqLocal := httptest.NewRequest(http.MethodGet, "/api/v1/memory/profile", nil)
	reqLocal.RemoteAddr = "127.0.0.1:12345"
	recLocal := httptest.NewRecorder()
	cLocal := e.NewContext(reqLocal, recLocal)

	err = mw(cLocal)
	if err != nil {
		e.HTTPErrorHandler(err, cLocal)
	}
	if recLocal.Code != http.StatusOK {
		t.Errorf("expected 200 for localhost request when password is empty, got %d", recLocal.Code)
	}

	// 3. Remote request spoofing loopback via X-Forwarded-For / X-Real-IP -> 403
	reqSpoof := httptest.NewRequest(http.MethodGet, "/api/v1/memory/profile", nil)
	reqSpoof.RemoteAddr = "203.0.113.7:12345"
	reqSpoof.Header.Set("X-Forwarded-For", "127.0.0.1")
	reqSpoof.Header.Set("X-Real-IP", "127.0.0.1")
	recSpoof := httptest.NewRecorder()
	cSpoof := e.NewContext(reqSpoof, recSpoof)

	err = mw(cSpoof)
	if err != nil {
		e.HTTPErrorHandler(err, cSpoof)
	}
	if recSpoof.Code != http.StatusForbidden {
		t.Errorf("expected 403 for remote request spoofing X-Forwarded-For, got %d", recSpoof.Code)
	}
}

// Sin contraseÃ±a, un equipo de la LAN puede reportar progreso o iniciar una
// reproducciÃ³n, pero no disparar escaneos, borrar notificaciones ni tocar la
// cronologÃ­a: solo localhost.
func TestOptionalAuthMiddleware_LANWritesRestricted(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	mw := h.OptionalAuthMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	cases := []struct {
		name, method, path, remote string
		want                       int
	}{
		{"LAN reporta progreso", http.MethodPost, "/api/v1/progress", "192.168.1.50:1", http.StatusOK},
		{"LAN inicia streaming", http.MethodPost, "/api/v1/mediastream/request", "192.168.1.50:1", http.StatusOK},
		{"LAN lee la biblioteca", http.MethodGet, "/api/v1/library/local-files", "192.168.1.50:1", http.StatusOK},
		{"LAN no dispara escaneo", http.MethodPost, "/api/v1/library/scan", "192.168.1.50:1", http.StatusForbidden},
		{"LAN no toca la cronologÃ­a", http.MethodPost, "/api/v1/intelligence/chronology/overrides", "192.168.1.50:1", http.StatusForbidden},
		{"LAN no borra notificaciones", http.MethodDelete, "/api/v1/notifications", "192.168.1.50:1", http.StatusForbidden},
		{"LAN no calienta miniaturas", http.MethodPost, "/api/v1/cache/thumbnails/warm", "192.168.1.50:1", http.StatusForbidden},
		{"localhost sÃ­ escanea", http.MethodPost, "/api/v1/library/scan", "127.0.0.1:1", http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.RemoteAddr = tc.remote
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if err := mw(c); err != nil {
				e.HTTPErrorHandler(err, c)
			}
			if rec.Code != tc.want {
				t.Errorf("%s %s desde %s: esperaba %d, obtuve %d", tc.method, tc.path, tc.remote, tc.want, rec.Code)
			}
		})
	}
}

func TestHandleEnqueuePreTranscode_Confinement(t *testing.T) {
	app, tempDir := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	// Setting up a library directory
	libraryDir := filepath.Join(tempDir, "media")
	_ = os.MkdirAll(libraryDir, 0755)
	_, _ = app.Database.UpsertSettings(&models.Settings{
		BaseModel: models.BaseModel{ID: 1},
		Library: models.LibrarySettings{
			SeriesPaths: []string{libraryDir},
		},
	})

	// File outside library
	outsideFile := filepath.Join(tempDir, "evil.mkv")
	_ = os.WriteFile(outsideFile, []byte("fake video"), 0644)

	body := map[string]string{"path": outsideFile}
	bodyBytes, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/mediastream/pretranscode", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	_ = h.HandleEnqueuePreTranscode(c)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for pretranscode on file outside library, got %d: %s", rec.Code, rec.Body.String())
	}
}
