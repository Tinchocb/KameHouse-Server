package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
)

// Exercises the actual collection handler and response serialization against a
// private SQLite library, with no metadata service, credentials or user files.
func TestLibraryCollectionFixtureLatency(t *testing.T) {
	t.Cleanup(ClearLibraryCollectionCache)
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "fixture", &logger)
	require.NoError(t, err)
	defer database.Close()
	for {
		done, err := database.MigrationStatus()
		require.NoError(t, err)
		if done {
			break
		}
		select {
		case <-t.Context().Done():
			t.Fatal(t.Context().Err())
		case <-time.After(time.Millisecond):
		}
	}
	files := make([]*dto.LocalFile, 0, 1200)
	for id := 1; id <= 50; id++ {
		media := &models.LibraryMedia{BaseModel: models.BaseModel{ID: uint(id)}, TmdbID: 10000 + id, Type: "SHOW", Format: "TV", TitleRomaji: fmt.Sprintf("Fixture %d", id), TotalEpisodes: 24}
		require.NoError(t, database.Gorm().Create(media).Error)
		status := "PLANNING"
		if id <= 5 {
			status = "CURRENT"
		}
		require.NoError(t, database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: uint(id), Status: status, Progress: 3}).Error)
		for ep := 1; ep <= 24; ep++ {
			files = append(files, &dto.LocalFile{Path: fmt.Sprintf("gdrive://fixture-%d-%d/episode.mkv", id, ep), Name: fmt.Sprintf("Episode %d.mkv", ep), MediaID: id, LibraryMediaId: uint(id), Metadata: &dto.LocalFileMetadata{Episode: ep, Episodes: []int{ep}, AniDBEpisode: fmt.Sprint(ep), Type: dto.LocalFileTypeMain}})
		}
	}
	require.NoError(t, db.UpsertLocalFileRelationalBatch(database, files))
	app := &core.App{}
	app.Database = database
	app.Logger = &logger
	app.Metadata.Platform = platform.NewDynamicPlatform(simulated_platform.NewSimulatedPlatform(&logger))
	h := &Handler{App: app}
	e := echo.New()
	for _, delay := range []time.Duration{0, 300 * time.Millisecond} {
		app.Metadata.Provider = metadata_provider.NewDynamicProvider(&collectionFixtureProvider{delay: delay})
		ClearLibraryCollectionCache()
		db.InvalidateLocalFilesCache(database)
		request := func(etag string) (*httptest.ResponseRecorder, time.Duration) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil)
			if etag != "" {
				req.Header.Set("If-None-Match", etag)
			}
			rec := httptest.NewRecorder()
			start := time.Now()
			require.NoError(t, h.HandleGetLibraryCollection(e.NewContext(req, rec)))
			return rec, time.Since(start)
		}
		rec, cold := request("")
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var response APIResponse[*anime.LibraryCollection]
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.NotNil(t, response.Data)
		require.Equal(t, 1200, response.Data.Stats.TotalFiles)
		require.Equal(t, 50, response.Data.Stats.TotalEntries)
		require.Len(t, response.Data.ContinueWatchingList, 5)
		_, warm := request("")
		unchanged, conditional := request(rec.Header().Get("ETag"))
		require.Equal(t, http.StatusNotModified, unchanged.Code)
		t.Logf("series=50 files=1200 current=5 metadata_delay=%s cold=%s warm=%s conditional=%s response_bytes=%d", delay, cold, warm, conditional, rec.Body.Len())
	}
	ClearLibraryCollectionCache()
}

type collectionFixtureProvider struct {
	metadata_provider.ProviderImpl
	delay time.Duration
}

func (p *collectionFixtureProvider) GetAnimeMetadata(int) (*metadata.AnimeMetadata, error) {
	if p.delay > 0 {
		time.Sleep(p.delay)
	}
	return nil, errors.New("isolated metadata unavailable fixture")
}
