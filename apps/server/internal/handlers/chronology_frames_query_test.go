package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func newChronologyQueryFixture(t *testing.T) (*Handler, *models.LibraryMedia) {
	t.Helper()
	app, _ := setupTestApp(t)
	deadline := time.Now().Add(5 * time.Second)
	for {
		complete, err := app.Database.MigrationStatus()
		if err != nil {
			t.Fatal(err)
		}
		if complete {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("fixture migrations did not finish")
		}
		time.Sleep(5 * time.Millisecond)
	}
	m := &models.LibraryMedia{Type: "SHOW", TmdbID: 123}
	if err := app.Database.Gorm().Create(m).Error; err != nil {
		t.Fatal(err)
	}
	episode := &models.LibraryEpisode{
		LibraryMediaID: m.ID, SeasonNumber: 1, EpisodeNumber: 1, AbsoluteNumber: 42,
		Image: "https://example.test/episode.jpg", Title: "Episode title", SagaName: "Saga",
		Description: strings.Repeat("unused description ", 4096),
	}
	if err := app.Database.Gorm().Create(episode).Error; err != nil {
		t.Fatal(err)
	}
	return &Handler{App: app}, m
}

func chronologyFileRequest(t *testing.T, h *Handler, ctx context.Context, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/library/episode-file?"+query, nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	if err := h.HandleGetLibraryEpisodeFile(echo.New().NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	return rec
}

func TestChronologyEpisodeProjectionAndLocalFallback(t *testing.T) {
	h, media := newChronologyQueryFixture(t)
	g := h.App.Database.Gorm()
	var episodeSQL string
	const callback = "test:chronology_episode_projection"
	if err := g.Callback().Query().After("gorm:query").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "library_episodes" {
			episodeSQL = tx.Statement.SQL.String()
		}
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { g.Callback().Query().Remove(callback) })
	rec := chronologyFileRequest(t, h, context.Background(), "tmdbId=123&absoluteEpisode=42")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "https://example.test/episode.jpg") {
		t.Fatalf("image lookup: %d %s", rec.Code, rec.Body.String())
	}
	if episodeSQL == "" || strings.Contains(episodeSQL, "*") || strings.Contains(episodeSQL, "description") || strings.Contains(episodeSQL, "tags") {
		t.Fatalf("episode query loads unused columns: %s", episodeSQL)
	}
	if err := g.Model(&models.LibraryEpisode{}).Where("library_media_id = ?", media.ID).Update("image", "").Error; err != nil {
		t.Fatal(err)
	}
	rec = chronologyFileRequest(t, h, context.Background(), "tmdbId=123&absoluteEpisode=42")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("missing local file: %d %s", rec.Code, rec.Body.String())
	}
	file := &models.LocalFile{
		Path: "C:/fixture/episode.mkv", LibraryMediaId: media.ID,
		Metadata: json.RawMessage("{\"episodes\":[42]}"), FileSize: 1234, FileModTime: 5678,
	}
	if err := g.Create(file).Error; err != nil {
		t.Fatal(err)
	}
	rec = chronologyFileRequest(t, h, context.Background(), "tmdbId=123&absoluteEpisode=42")
	var response struct {
		Data struct {
			Path            string
			HasImage        bool
			AbsoluteEpisode int
			Title           string
			SagaName        string
			FileSize        int64
			FileModTime     int64
		}
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	got := response.Data
	if rec.Code != http.StatusOK || got.Path != file.Path || got.HasImage || got.AbsoluteEpisode != 42 || got.Title != "Episode title" || got.SagaName != "Saga" || got.FileSize != file.FileSize || got.FileModTime != file.FileModTime {
		t.Fatalf("fallback lost fields: %d %+v", rec.Code, got)
	}
	for _, query := range []string{"tmdbId=999&absoluteEpisode=42", "tmdbId=123&absoluteEpisode=43"} {
		if rec := chronologyFileRequest(t, h, context.Background(), query); rec.Code != http.StatusNotFound {
			t.Fatalf("missing series/episode: %d %s", rec.Code, rec.Body.String())
		}
	}
}

func TestChronologyEpisodeQueriesHonorCancellation(t *testing.T) {
	for _, stage := range []string{"library_media", "library_episodes", "local_file"} {
		t.Run(stage, func(t *testing.T) {
			h, media := newChronologyQueryFixture(t)
			g := h.App.Database.Gorm()
			if err := g.Model(&models.LibraryEpisode{}).Where("library_media_id = ?", media.ID).Update("image", "").Error; err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			const callback = "test:chronology_cancel"
			seen := false
			if err := g.Callback().Query().Before("gorm:query").Register(callback, func(tx *gorm.DB) {
				if tx.Statement.Table == stage {
					seen = true
					cancel()
				}
			}); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { g.Callback().Query().Remove(callback) })
			rec := chronologyFileRequest(t, h, ctx, "tmdbId=123&absoluteEpisode=42")
			if !seen || rec.Code == http.StatusNotFound || rec.Code == http.StatusOK || !strings.Contains(rec.Body.String(), context.Canceled.Error()) {
				t.Fatalf("cancellation treated as missing data: seen=%v code=%d body=%s", seen, rec.Code, rec.Body.String())
			}
		})
	}
}
