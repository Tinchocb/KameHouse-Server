package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

// Si el transcoder falla, el asistente no debe quedar cerrado con la biblioteca guardada:
// el reintento tiene que volver a pedir el asistente completo.
func TestAsistenteInicialNoCierraSiFallaElTranscoder(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	dir := "/mnt/media/anime"
	if runtime.GOOS == "windows" {
		dir = `D:\Anime`
	}

	// Contexto ya cancelado: SetTranscodeEnabled falla antes de tocar la base.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	body := `{"library":{"seriesPaths":["` + strings.ReplaceAll(dir, `\`, `\\`) + `"],"moviePaths":[]},"mediaPlayer":{},"enableTranscode":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/start", strings.NewReader(body)).WithContext(ctx)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.HandleGettingStarted(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}
	if rec.Code == http.StatusOK {
		t.Fatal("con el transcoder fallando, /start no debía responder 200")
	}

	stored, err := app.Database.GetStoredSettings()
	if err != nil {
		t.Fatal(err)
	}
	if !stored.SetupPending {
		t.Error("el asistente debía seguir pendiente tras el error")
	}
	if len(stored.Library.SeriesPaths) != 0 {
		t.Errorf("no debía guardarse la carpeta tras el error: %v", stored.Library.SeriesPaths)
	}
}
