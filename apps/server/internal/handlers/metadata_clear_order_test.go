package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

type completingMetadataProvider struct {
	metadata_provider.ProviderImpl
	database        *db.Database
	calls           int
	err             error
	staleReadCached bool
}

func (p *completingMetadataProvider) ClearCache() {
	p.calls++
	p.staleReadCached = false
	if p.calls == 1 {
		// Model a write already admitted when ClearCache starts. A real
		// provider joins this publication before returning from its barrier.
		p.err = db.UpsertMetadataCache(p.database, "tmdb-anime-episodes", "fixture", true, time.Hour)
	}
}

func TestClearMetadataJoinsOldPublicationBeforeDeletingSQL(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "clear-order", &logger)
	require.NoError(t, err)
	defer database.Close()
	waitMetadataClearMigrations(t, database)
	provider := &completingMetadataProvider{database: database}
	readDuringDelete := false
	require.NoError(t, database.Gorm().Callback().Delete().Before("gorm:delete").Register("fixture:read_during_clear", func(tx *gorm.DB) {
		if _, ok := tx.Statement.Dest.(*models.MetadataCache); !ok || readDuringDelete {
			return
		}
		readDuringDelete = true
		// This is a read from the interval after the first barrier, while
		// durable deletion has not yet reached the episodes provider.
		var value bool
		found, err := db.GetMetadataCache(database, "tmdb-anime-episodes", "fixture", &value)
		if err != nil {
			t.Error(err)
		}
		provider.staleReadCached = found
	}))
	app := &core.App{}
	app.Database = database
	app.Metadata.Provider = metadata_provider.NewDynamicProvider(provider)
	h := &Handler{App: app}
	rec := httptest.NewRecorder()
	require.NoError(t, h.HandleClearMetadataCache(echo.New().NewContext(httptest.NewRequest(http.MethodDelete, "/api/v1/metadata/cache", nil), rec)))
	require.NoError(t, provider.err)
	require.Equal(t, http.StatusOK, rec.Code)
	var value bool
	found, err := db.GetMetadataCache(database, "tmdb-anime-episodes", "fixture", &value)
	require.NoError(t, err)
	require.False(t, found, "a publication joined by ClearCache survived the subsequent SQL clear")
	require.True(t, readDuringDelete)
	require.False(t, provider.staleReadCached, "a read overlapping SQL deletion remained cached")
}

func TestClearMetadataReportsDeleteFailure(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "clear-error", &logger)
	require.NoError(t, err)
	defer database.Close()
	waitMetadataClearMigrations(t, database)
	require.NoError(t, database.Gorm().Callback().Delete().Before("gorm:delete").Register("fixture:delete_failure", func(tx *gorm.DB) { tx.AddError(errors.New("metadata deletion fixture failure")) }))
	app := &core.App{}
	app.Database = database
	app.Metadata.Provider = metadata_provider.NewDynamicProvider(&metadata_provider.ProviderImpl{})
	h := &Handler{App: app}
	rec := httptest.NewRecorder()
	require.NoError(t, h.HandleClearMetadataCache(echo.New().NewContext(httptest.NewRequest(http.MethodDelete, "/api/v1/metadata/cache", nil), rec)))
	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.Contains(t, rec.Body.String(), "metadata deletion fixture failure")
}

func waitMetadataClearMigrations(t *testing.T, database *db.Database) {
	t.Helper()
	for {
		done, err := database.MigrationStatus()
		require.NoError(t, err)
		if done {
			return
		}
		select {
		case <-t.Context().Done():
			t.Fatal(t.Context().Err())
		case <-time.After(time.Millisecond):
		}
	}
}
