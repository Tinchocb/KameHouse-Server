package metadata_provider

import (
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	apiMetadata "kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func TestTMDBPublicIdentityAndTypedPersistentCache(t *testing.T) {
	l := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "identity", &l)
	require.NoError(t, err)
	defer database.Close()
	waitGenerationMigrations(t, database)
	for _, m := range []*models.LibraryMedia{
		{BaseModel: models.BaseModel{ID: 1}, TmdbID: 123, Type: "SHOW"},
		{BaseModel: models.BaseModel{ID: 123}, TmdbID: 456, Type: "SHOW"},
		{BaseModel: models.BaseModel{ID: 124}, TmdbID: 123, Type: "MOVIE", Format: "MOVIE"},
	} {
		require.NoError(t, database.Gorm().Create(m).Error)
	}
	p := NewTMDBProviderImpl(tmdb.NewClient("fixture", "en-US"), database, &l)
	defer p.Close()
	for key, count := range map[string]int{
		p.metadataKey(123, 123): 99, p.metadataKey(456, 456): 77,
		p.metadataKey(1_000_123, 123): 1,
		"123":                         666, // Legacy unqualified cache must never be consumed.
	} {
		require.NoError(t, db.UpsertMetadataCache(database, "tmdb-anime-episodes", key, &apiMetadata.AnimeMetadata{EpisodeCount: count}, time.Hour))
	}
	for id, count := range map[int]int{123: 99, 456: 77, 1_000_123: 1} {
		got, err := p.GetAnimeMetadata(id)
		require.NoError(t, err)
		require.Equal(t, count, got.EpisodeCount)
	}
	other := NewTMDBProviderImpl(tmdb.NewClient("fixture", "es-MX"), database, &l)
	defer other.Close()
	require.NotEqual(t, p.metadataKey(123, 123), other.metadataKey(123, 123))
	routing := NewRoutingProvider(nil, p, database)
	got, err := routing.GetAnimeMetadata(123)
	require.NoError(t, err)
	require.Equal(t, 99, got.EpisodeCount)
}
