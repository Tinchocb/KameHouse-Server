package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestChronologySpanOverridesHandler(t *testing.T) {
	app, _ := setupTestApp(t)
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	post := func(body string) int {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/intelligence/chronology/overrides", bytes.NewReader([]byte(body)))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		_ = h.HandleSaveChronologySpanOverrides(e.NewContext(req, rec))
		return rec.Code
	}

	for _, bad := range []string{
		`{"overrides":{"DB-Pilaf":true}}`,
		`{"overrides":{"db pilaf":true}}`,
		`{"overrides":{"../x":true}}`,
		`{"overrides":{"":true}}`,
	} {
		if code := post(bad); code != http.StatusBadRequest {
			t.Errorf("expected 400 for %s, got %d", bad, code)
		}
	}

	if code := post(`{"overrides":{"db-pilaf":true,"dbz-juegos-de-cell":false}}`); code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}
	if code := post(`{"overrides":{"dbz-juegos-de-cell":null}}`); code != http.StatusOK {
		t.Fatalf("expected 200 clearing override, got %d", code)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/intelligence/chronology", nil)
	rec := httptest.NewRecorder()
	if err := h.HandleGetChronologyProgress(e.NewContext(req, rec)); err != nil {
		t.Fatalf("HandleGetChronologyProgress: %v", err)
	}
	var resp struct {
		Data struct {
			Overrides map[string]bool `json:"overrides"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Data.Overrides) != 1 || !resp.Data.Overrides["db-pilaf"] {
		t.Errorf("overrides = %v", resp.Data.Overrides)
	}
}
