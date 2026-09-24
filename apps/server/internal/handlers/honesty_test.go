package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kamehouse/internal/core"
	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

func newBareHandler() (*Handler, *echo.Echo) {
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler
	return &Handler{App: &core.App{}}, e
}

func doRequest(h *Handler, e *echo.Echo, method, path, body string, fn func(c echo.Context) error) *httptest.ResponseRecorder {
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	_ = fn(c)
	return rec
}

// Los stubs eliminados deben responder 501 honesto, no 200 con datos falsos.
func TestStubEndpointsReturn501(t *testing.T) {
	h, e := newBareHandler()
	cases := []struct {
		name   string
		method string
		path   string
		fn     func(c echo.Context) error
	}{
		{"announcements", http.MethodPost, "/api/v1/announcements", h.HandleGetAnnouncements},
		{"home-items GET", http.MethodGet, "/api/v1/status/home-items", h.HandleGetHomeItems},
		{"home-items POST", http.MethodPost, "/api/v1/status/home-items", h.HandleUpdateHomeItems},
		{"local queue", http.MethodGet, "/api/v1/local/queue", h.HandleLocalGetSyncQueueState},
		{"config metadata", http.MethodGet, "/api/v1/config/metadata", h.HandleGetConfigMetadata},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := doRequest(h, e, tc.method, tc.path, "", tc.fn)
			if rec.Code != http.StatusNotImplemented {
				t.Errorf("expected 501, got %d (body: %s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestProgressValidation400(t *testing.T) {
	h, e := newBareHandler()
	cases := []struct {
		name string
		body string
	}{
		{"mediaId zero", `{"mediaId":0,"progress":5}`},
		{"mediaId negative", `{"mediaId":-3,"progress":5}`},
		{"progress negative", `{"mediaId":12,"progress":-1}`},
		{"repeat negative", `{"mediaId":12,"repeat":-1}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var rec *httptest.ResponseRecorder
			if strings.HasPrefix(tc.name, "repeat") {
				rec = doRequest(h, e, http.MethodPost, "/api/v1/library/anime-entry/repeat", tc.body, h.HandleUpdateAnimeEntryRepeat)
			} else {
				rec = doRequest(h, e, http.MethodPost, "/api/v1/library/anime-entry/progress", tc.body, h.HandleUpdateAnimeEntryProgress)
			}
			if rec.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d (body: %s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestResolveRequiresFields400(t *testing.T) {
	h, e := newBareHandler()
	for _, body := range []string{`{}`, `{"path":"/x.mkv"}`, `{"targetMediaId":7}`} {
		rec := doRequest(h, e, http.MethodPost, "/api/v1/library/unlinked/resolve", body, h.HandleResolveUnlinkedFile)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for body %s, got %d", body, rec.Code)
		}
	}
}

func TestRetagEpisodesCountsHonestly(t *testing.T) {
	app, _ := setupTestApp(t)
	nop := zerolog.Nop()
	app.Logger = &nop
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	db := app.Database.Gorm()
	if err := db.Create(&models.LibraryMedia{Type: "ANIME", Format: "TV", TitleEnglish: "Test Show"}).Error; err != nil {
		t.Fatalf("seed media: %v", err)
	}
	for i, title := range []string{"Goku vs Vegeta", "Cooking with Gohan"} {
		if err := db.Create(&models.LibraryEpisode{
			LibraryMediaID: 1,
			SeasonNumber:   1,
			EpisodeNumber:  i + 1,
			Title:          title,
		}).Error; err != nil {
			t.Fatalf("seed episode: %v", err)
		}
	}

	rec := doRequest(h, e, http.MethodPost, "/api/v1/home/retag", "", h.HandleRetagEpisodes)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	var envelope struct {
		Data struct {
			EpisodesRetagged int `json:"episodes_retagged"`
			TotalEpisodes    int `json:"total_episodes"`
			MediaRetagged    int `json:"media_retagged"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Data.TotalEpisodes != 2 || envelope.Data.EpisodesRetagged != 2 {
		t.Errorf("expected 2/2 episodes, got %+v", envelope.Data)
	}
	if envelope.Data.MediaRetagged != 1 {
		t.Errorf("expected media_retagged=1 (real count, not total), got %+v", envelope.Data)
	}
}

func TestDownloadBackupLatest(t *testing.T) {
	app, tempDir := setupTestApp(t)
	nop := zerolog.Nop()
	app.Logger = &nop
	h := &Handler{App: app}
	e := echo.New()
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	// Sin backups → 404, no 500.
	rec := doRequest(h, e, http.MethodGet, "/api/v1/db/backup/download", "", h.HandleDownloadDatabaseBackup)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 without backups, got %d", rec.Code)
	}

	// Con backup → 200 + attachment.
	backupDir := filepath.Join(tempDir, "appdata", "backups")
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		t.Fatalf("mkdir backups: %v", err)
	}
	// setupTestApp usa appDataDir = tempDir/appdata; el handler usa Config.Data.AppDataDir.
	if err := os.WriteFile(filepath.Join(backupDir, "kamehouse-backup-2024-01-01_00-00-00.db"), []byte("fake-db"), 0600); err != nil {
		t.Fatalf("seed backup: %v", err)
	}
	rec = doRequest(h, e, http.MethodGet, "/api/v1/db/backup/download", "", h.HandleDownloadDatabaseBackup)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
	}
	if disp := rec.Header().Get("Content-Disposition"); !strings.Contains(disp, "kamehouse-backup-2024-01-01_00-00-00.db") {
		t.Errorf("expected attachment filename, got %q", disp)
	}
	if rec.Body.String() != "fake-db" {
		t.Errorf("unexpected body %q", rec.Body.String())
	}
}
