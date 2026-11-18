package metadata

import (
	"context"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"testing"
	"time"
)

func TestSavedSeasonSurvivesProviderRestartAndExpiry(t *testing.T) {
	logger := zerolog.Nop()
	database, err := db.NewDatabase(context.Background(), t.TempDir(), "seasons", &logger)
	require.NoError(t, err)
	defer database.Close()
	season := tmdb.TVSeasonDetails{SeasonNumber: 1, Episodes: []tmdb.TVEpisode{{EpisodeNumber: 1, Overview: "Saved synopsis", StillPath: "/still.jpg"}}}
	require.NoError(t, db.UpsertMetadataCache(database, "episode-season", "1:1:es-MX", savedSeason{season, time.Now()}, 0))
	provider := NewTMDBProvider("", database, "es-MX")
	got, err := provider.GetTVSeason(context.Background(), 1, 1)
	require.NoError(t, err)
	require.Equal(t, season, got)
	require.NoError(t, db.UpsertMetadataCache(database, "episode-season", "1:1:es-MX", savedSeason{season, time.Now().Add(-8 * 24 * time.Hour)}, 0))
	restarted := NewTMDBProvider("", database, "es-MX")
	got, found, fresh := restarted.CachedSeason(1, 1)
	require.True(t, found)
	require.False(t, fresh)
	require.Equal(t, season, got)
	got, err = restarted.GetTVSeason(context.Background(), 1, 1)
	require.NoError(t, err)
	require.Equal(t, season, got)
	wrongLanguage := NewTMDBProvider("", database, "en-US")
	_, found, _ = wrongLanguage.CachedSeason(1, 1)
	require.False(t, found)
}
