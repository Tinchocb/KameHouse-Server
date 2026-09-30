package handlers

import (
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"

	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
)

func TestNormalizeLibraryPath(t *testing.T) {
	blocked := []string{"/etc", "/usr/lib", "/home/yo/.ssh"}
	ok := map[string]string{"/mnt/media/anime": "/mnt/media/anime", "/mnt/media//anime/": "/mnt/media/anime"}
	if runtime.GOOS == "windows" {
		blocked = []string{`C:\`, `C:/`, `C:\Windows`, `c:\windows\system32`, `C:/Program Files/App`, `C:\ProgramData`, `D:\Users\yo\.ssh`}
		ok = map[string]string{`D:\Anime`: "D:/Anime", `D:\Media\Series\`: "D:/Media/Series", "  D:\\Anime  ": "D:/Anime"}
	}

	for in, want := range ok {
		got, err := normalizeLibraryPath(in)
		if err != nil || got != want {
			t.Errorf("normalizeLibraryPath(%q) = %q, %v; se esperaba %q", in, got, err, want)
		}
	}
	for _, in := range blocked {
		if got, err := normalizeLibraryPath(in); err == nil {
			t.Errorf("normalizeLibraryPath(%q) = %q; una carpeta de sistema debía rechazarse", in, got)
		}
	}
	for _, in := range []string{"", "   ", "."} {
		if got, err := normalizeLibraryPath(in); err != nil || got != "" {
			t.Errorf("normalizeLibraryPath(%q) = %q, %v; una ruta vacía se descarta sin error", in, got, err)
		}
	}
	// Las comas romperían el guardado en CSV.
	if _, err := normalizeLibraryPath("/mnt/a,b"); err == nil {
		t.Error("una ruta con coma debía rechazarse")
	}
}

func TestNormalizeLibraryPathsDescartaVaciasYRechazaSiUnaFalla(t *testing.T) {
	good := "/mnt/media/anime"
	bad := "/etc"
	if runtime.GOOS == "windows" {
		good, bad = `D:\Anime`, `C:\Windows`
	}
	got, err := normalizeLibraryPaths([]string{good, "", "  ", good})
	if err != nil || len(got) != 2 {
		t.Fatalf("normalizeLibraryPaths = %v, %v; se esperaban 2 rutas", got, err)
	}
	if _, err := normalizeLibraryPaths([]string{good, bad}); err == nil {
		t.Error("una sola ruta inválida debe rechazar la lista entera")
	}
}

func systemDir() string {
	if runtime.GOOS == "windows" {
		return `C:\Windows`
	}
	return "/etc"
}

// El asistente inicial guardaba las carpetas tal cual llegaban, sin ninguna de las
// reglas del guardado de ajustes.
func TestHandleGettingStartedRechazaCarpetasDeSistema(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	for name, body := range map[string]string{
		"serie de sistema":    `{"library":{"seriesPaths":["` + strings.ReplaceAll(systemDir(), `\`, `\\`) + `"],"moviePaths":[]},"mediaPlayer":{}}`,
		"película de sistema": `{"library":{"seriesPaths":[],"moviePaths":["` + strings.ReplaceAll(systemDir(), `\`, `\\`) + `"]},"mediaPlayer":{}}`,
		"con coma":            `{"library":{"seriesPaths":["/mnt/a,b"],"moviePaths":[]},"mediaPlayer":{}}`,
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/start", strings.NewReader(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			if err := h.HandleGettingStarted(c); err != nil {
				e.HTTPErrorHandler(err, c)
			}
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, se esperaba 400 (%s)", rec.Code, rec.Body.String())
			}
			if s, _ := app.Database.GetStoredSettings(); s != nil && (len(s.Library.SeriesPaths) > 0 || len(s.Library.MoviePaths) > 0) {
				t.Errorf("no debía guardarse ninguna carpeta: %+v", s.Library)
			}
		})
	}
}

func TestHandleSaveSettingsRechazaCarpetasDeSistema(t *testing.T) {
	app, _ := setupTestApp(t)
	if _, err := app.Database.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}}); err != nil {
		t.Fatal(err)
	}
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	body := `{"library":{"seriesPaths":["` + strings.ReplaceAll(systemDir(), `\`, `\\`) + `"]}}`
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/settings", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h.HandleSaveSettings(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}
	if rec.Code == http.StatusOK {
		t.Fatalf("una carpeta de sistema no debía guardarse (status %d)", rec.Code)
	}
	if s, _ := app.Database.GetStoredSettings(); s != nil && len(s.Library.SeriesPaths) > 0 {
		t.Errorf("no debía guardarse ninguna carpeta: %v", s.Library.SeriesPaths)
	}
}
