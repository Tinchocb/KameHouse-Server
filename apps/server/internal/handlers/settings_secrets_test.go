package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
)

func TestHandleGetSettings_MasksSecrets(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}

	s := &models.Settings{BaseModel: models.BaseModel{ID: 1}}
	s.Library.TmdbApiKey = "tmdb-real-key-abcd"
	s.GoogleDrive.ClientSecret = "drive-real-secret-efgh"
	s.GoogleDrive.RefreshToken = "drive-real-refresh-ijkl"
	if _, err := app.Database.UpsertSettings(s); err != nil {
		t.Fatalf("upsert settings: %v", err)
	}

	e := echo.New()
	rec := httptest.NewRecorder()
	c := e.NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil), rec)
	if err := h.HandleGetSettings(c); err != nil {
		t.Fatalf("HandleGetSettings: %v", err)
	}

	body := rec.Body.String()
	for _, secret := range []string{"tmdb-real-key-abcd", "drive-real-secret-efgh", "drive-real-refresh-ijkl"} {
		if strings.Contains(body, secret) {
			t.Errorf("response leaks secret %q", secret)
		}
	}
	if !strings.Contains(body, models.SecretMaskPrefix+"abcd") {
		t.Errorf("expected masked TMDB key in response, got %s", body)
	}

	// La caché compartida conserva el valor real para el resto del servidor.
	if cur, _ := app.Database.GetSettings(); cur == nil || cur.Library.TmdbApiKey != "tmdb-real-key-abcd" {
		t.Error("stored settings must keep the real TMDB key")
	}
}
