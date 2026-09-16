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
	database, err := db.NewDatabase(context.Background(), "", "test_db", &l)
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
}

func TestHandleOpenInExplorer_Confinement(t *testing.T) {
	app, tempDir := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	// Register a library path in settings
	libraryDir := filepath.Join(tempDir, "anime_library")
	_ = os.MkdirAll(libraryDir, 0755)
	_, _ = app.Database.UpsertSettings(&models.Settings{
		BaseModel: models.BaseModel{ID: 1},
		Library: models.LibrarySettings{
			SeriesPaths: []string{libraryDir},
		},
	})

	// Request with path inside library -> Should be allowed (stat ok)
	bodyInside := map[string]string{"path": libraryDir}
	bodyInsideBytes, _ := json.Marshal(bodyInside)
	reqInside := httptest.NewRequest(http.MethodPost, "/api/v1/open-in-explorer", bytes.NewReader(bodyInsideBytes))
	reqInside.Header.Set("Content-Type", "application/json")
	recInside := httptest.NewRecorder()
	cInside := e.NewContext(reqInside, recInside)

	_ = h.HandleOpenInExplorer(cInside)
	if recInside.Code != http.StatusOK {
		t.Errorf("expected 200 for path inside library, got %d", recInside.Code)
	}

	// Request with path outside library and app data -> Should return 403
	outsideDir := filepath.Join(tempDir, "random_outside_dir")
	_ = os.MkdirAll(outsideDir, 0755)
	bodyOutside := map[string]string{"path": outsideDir}
	bodyOutsideBytes, _ := json.Marshal(bodyOutside)
	reqOutside := httptest.NewRequest(http.MethodPost, "/api/v1/open-in-explorer", bytes.NewReader(bodyOutsideBytes))
	reqOutside.Header.Set("Content-Type", "application/json")
	recOutside := httptest.NewRecorder()
	cOutside := e.NewContext(reqOutside, recOutside)

	_ = h.HandleOpenInExplorer(cOutside)
	if recOutside.Code != http.StatusForbidden {
		t.Errorf("expected 403 for path outside library, got %d: %s", recOutside.Code, recOutside.Body.String())
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
