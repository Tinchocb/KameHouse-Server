package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/library/fillermanager"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/constants"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func TestManualAssignProviderIdentityAndSelectedFiles(t *testing.T) {
	for _, tc := range []struct {
		provider, kind, wantType string
		id                       int
	}{
		{"tmdb", "tv", "SHOW", 77}, {"tmdb", "movie", "MOVIE", 77 + constants.MovieIDOffset}, {"jikan", "tv", "ANIME", 77},
	} {
		t.Run(tc.provider+tc.kind, func(t *testing.T) {
			app, _ := setupTestApp(t)
			logger := zerolog.Nop()
			app.Logger = &logger
			app.Config.Metadata.TMDBApiKey = "test-only"
			for _, path := range []string{"selected.mkv", "other.mkv"} {
				require.NoError(t, app.Database.Gorm().Create(&models.LocalFile{Path: path, Name: "original", MediaID: 9}).Error)
			}
			key := "77"
			if tc.kind == "movie" {
				key = fmt.Sprint(tc.id)
			}
			namespace := tc.provider + "-media-details"
			require.NoError(t, db.UpsertMetadataCache(app.Database, namespace, key, &dto.NormalizedMedia{}, time.Hour))
			h := &Handler{App: app}
			e := echo.New()
			body := fmt.Sprintf(`{"paths":["selected.mkv"],"provider":%q,"externalId":77,"mediaType":%q}`, tc.provider, tc.kind)
			rec := doRequest(h, e, http.MethodPost, "/", body, h.HandleTMDBAssign)
			require.Equal(t, 200, rec.Code, rec.Body.String())
			var selected, other models.LocalFile
			require.NoError(t, app.Database.Gorm().Where("path = ?", "selected.mkv").First(&selected).Error)
			require.NoError(t, app.Database.Gorm().Where("path = ?", "other.mkv").First(&other).Error)
			require.Equal(t, tc.id, selected.MediaID)
			require.True(t, selected.Locked)
			require.Equal(t, 9, other.MediaID)
			require.False(t, other.Locked)
			var media models.LibraryMedia
			require.NoError(t, app.Database.Gorm().First(&media, selected.LibraryMediaId).Error)
			require.Equal(t, tc.wantType, media.Type)
			if tc.provider == "jikan" {
				require.Equal(t, 77, media.MyanimelistId)
			}
		})
	}
}

func TestManualAssignmentConcurrentAndMissingPathRollback(t *testing.T) {
	app, _ := setupTestApp(t)
	d := app.Database
	for _, path := range []string{"a.mkv", "b.mkv"} {
		require.NoError(t, d.Gorm().Create(&models.LocalFile{Path: path, Name: path}).Error)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i, path := range []string{"a.mkv", "b.mkv"} {
		wg.Add(1)
		go func(id int, path string) {
			defer wg.Done()
			errs <- db.AssignLibraryMediaFiles(context.Background(), d, &models.LibraryMedia{Type: "SHOW", TmdbID: id}, id, []string{path})
		}(i+10, path)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	for i, path := range []string{"a.mkv", "b.mkv"} {
		var f models.LocalFile
		require.NoError(t, d.Gorm().Where("path = ?", path).First(&f).Error)
		require.Equal(t, i+10, f.MediaID)
	}
	err := db.AssignLibraryMediaFiles(context.Background(), d, &models.LibraryMedia{Type: "SHOW", TmdbID: 99}, 99, []string{"a.mkv", "missing.mkv"})
	require.ErrorIs(t, err, db.ErrAssignmentPathNotFound)
	var count int64
	require.NoError(t, d.Gorm().Model(&models.LibraryMedia{}).Where("tmdb_id = ?", 99).Count(&count).Error)
	require.Zero(t, count)
}

func TestManualProgressPersistsAfterReopen(t *testing.T) {
	t.Setenv("TEST_ENV", "false")
	app, dir := setupTestApp(t)
	media := &models.LibraryMedia{Type: "MOVIE", TmdbID: 77, TotalEpisodes: 1}
	require.NoError(t, app.Database.Gorm().Create(media).Error)
	require.NoError(t, app.Database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: media.ID, Score: 8.5}).Error)
	h := &Handler{App: app}
	e := echo.New()
	for _, progress := range []int{1, 0, 1} {
		body := fmt.Sprintf(`{"mediaId":%d,"progress":%d}`, 77+constants.MovieIDOffset, progress)
		rec := doRequest(h, e, http.MethodPost, "/", body, h.HandleUpdateAnimeEntryProgress)
		require.Equal(t, 200, rec.Code, rec.Body.String())
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.Equal(t, true, response["data"])
		row, err := db.GetMediaEntryListData(app.Database, media.ID)
		require.NoError(t, err)
		require.Equal(t, progress, row.Progress)
		require.Equal(t, 8.5, row.Score)
	}
	app.Database.Shutdown()
	require.NoError(t, app.Database.Close())
	logger := zerolog.Nop()
	reopened, err := db.NewDatabase(context.Background(), filepath.Join(dir, "appdata"), "test_db", &logger)
	require.NoError(t, err)
	t.Cleanup(func() { reopened.Shutdown(); _ = reopened.Close() })
	row, err := db.GetMediaEntryListData(reopened, media.ID)
	require.NoError(t, err)
	require.Equal(t, 1, row.Progress)
	require.Equal(t, "COMPLETED", row.Status)
	// Read through the actual detail handler after reopening, without network
	// providers or background enrichment participating in the result.
	app.Database = reopened
	app.Logger = &logger
	app.Metadata.Platform = platform.NewDynamicPlatform(simulated_platform.NewSimulatedPlatform(&logger))
	app.Metadata.Provider = metadata_provider.NewDynamicProvider(nil)
	app.FillerManager = fillermanager.New(&fillermanager.NewFillerManagerOptions{DB: reopened, Logger: &logger})
	publicID := 77 + constants.MovieIDOffset
	fillerFetchAttempts.Store(publicID, true)
	enrichmentCooldown.Store(publicID, time.Now().Add(time.Hour))
	t.Cleanup(func() {
		fillerFetchAttempts.Delete(publicID)
		enrichmentCooldown.Delete(publicID)
		ClearAnimeEntryCache()
	})
	ClearAnimeEntryCache()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/library/anime-entry/1000077", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(fmt.Sprint(publicID))
	require.NoError(t, h.HandleGetAnimeEntry(c))
	require.Equal(t, 200, rec.Code, rec.Body.String())
	var detail struct {
		Data struct {
			ListData struct {
				Progress int `json:"progress"`
			} `json:"listData"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &detail))
	require.Equal(t, 1, detail.Data.ListData.Progress)

}
