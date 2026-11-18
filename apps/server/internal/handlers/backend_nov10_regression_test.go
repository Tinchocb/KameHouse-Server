package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/util/filecache"
)

func TestManualCacheClearIncludesValidMetadataAndStoryboards(t *testing.T) {
	for _, target := range []string{"all", "metadata", "storyboards"} {
		t.Run(target, func(t *testing.T) {
			h, _ := newChronologyQueryFixture(t)
			l := zerolog.Nop()
			h.App.Logger = &l
			h.App.Config.Cache.Dir = t.TempDir()
			require.NoError(t, db.UpsertMetadataCache(h.App.Database, "tmdb-api", "fixture", true, time.Hour))
			require.NoError(t, db.UpsertMetadataCache(h.App.Database, "migrations", "fixture", true, 0))
			dir := filepath.Join(h.App.Config.Cache.Dir, "storyboards")
			require.NoError(t, os.MkdirAll(dir, 0700))
			file := filepath.Join(dir, "frame.jpg")
			require.NoError(t, os.WriteFile(file, []byte("preview"), 0600))
			rec := httptest.NewRecorder()
			require.NoError(t, h.HandleGetCacheStats(echo.New().NewContext(httptest.NewRequest("GET", "/api/v1/system/cache/stats", nil), rec)))
			var stats struct {
				Data CacheStatsResponse `json:"data"`
			}
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &stats))
			require.EqualValues(t, 7, stats.Data.Storyboards.DiskSizeBytes)
			require.GreaterOrEqual(t, stats.Data.TotalDiskSizeBytes, int64(7))
			rec = httptest.NewRecorder()
			require.NoError(t, h.HandleClearSystemCache(echo.New().NewContext(httptest.NewRequest("POST", "/api/v1/system/cache/clear?target="+target, nil), rec)))
			require.Equal(t, http.StatusOK, rec.Code)
			var out bool
			found, err := db.GetMetadataCache(h.App.Database, "tmdb-api", "fixture", &out)
			require.NoError(t, err)
			require.Equal(t, target == "storyboards", found)
			found, err = db.GetMetadataCache(h.App.Database, "migrations", "fixture", &out)
			require.NoError(t, err)
			require.True(t, found)
			_, err = os.Stat(file)
			require.Equal(t, target != "metadata", errors.Is(err, os.ErrNotExist))
		})
	}
}

func TestSystemMetadataClearReportsDatabaseFailure(t *testing.T) {
	h, _ := newChronologyQueryFixture(t)
	l := zerolog.Nop()
	h.App.Logger = &l
	require.NoError(t, h.App.Database.Gorm().Callback().Delete().Before("gorm:delete").Register("fixture:delete_error", func(tx *gorm.DB) { tx.AddError(errors.New("fixture deletion failed")) }))
	rec := httptest.NewRecorder()
	require.NoError(t, h.HandleClearSystemCache(echo.New().NewContext(httptest.NewRequest("POST", "/api/v1/system/cache/clear?target=metadata", nil), rec)))
	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestEnableTranscodePublishesSettingsAndRefreshesEngine(t *testing.T) {
	h, _ := newChronologyQueryFixture(t)
	l := zerolog.Nop()
	h.App.Logger = &l
	h.App.Config.Cache.Dir = t.TempDir()
	h.App.Config.Cache.TranscodeDir = t.TempDir()
	fc, cacheErr := filecache.NewCacher(h.App.Config.Cache.Dir)
	require.NoError(t, cacheErr)
	h.App.FileCacher = fc
	t.Cleanup(func() { require.NoError(t, fc.Close()) })
	s := &models.MediastreamSettings{BaseModel: models.BaseModel{ID: 1}, TranscodeEnabled: false, DirectPlayOnly: true, TranscodeHwAccel: "disabled", TranscodeThreads: 3}
	_, err := h.App.Database.UpsertMediastreamSettings(s)
	require.NoError(t, err)
	h.App.MediastreamRepository = mediastream.NewRepository(&mediastream.NewRepositoryOptions{Logger: &l})
	t.Cleanup(h.App.MediastreamRepository.OnCleanup)
	require.NoError(t, h.App.Database.SetTranscodeEnabled(t.Context(), true))
	h.App.InitOrRefreshMediastreamSettings()
	got, found := h.App.Database.GetMediastreamSettings()
	require.True(t, found)
	require.True(t, got.TranscodeEnabled)
	require.True(t, got.DirectPlayOnly)
	require.Equal(t, 3, got.TranscodeThreads)
	require.False(t, s.TranscodeEnabled, "published snapshots must stay immutable")
	engine := h.App.MediastreamRepository.GetSettings().MustGet()
	require.True(t, engine.TranscodeEnabled)
	require.True(t, engine.DirectPlayOnly)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	require.ErrorIs(t, h.App.Database.SetTranscodeEnabled(ctx, false), context.Canceled)
	got, _ = h.App.Database.GetMediastreamSettings()
	require.True(t, got.TranscodeEnabled)
}
