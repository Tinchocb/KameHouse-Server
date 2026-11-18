package handlers

import (
	"testing"

	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestEpisodeEnrichmentProviderUsesTMDBWithLegacyScanner(t *testing.T) {
	t.Setenv("KAMEHOUSE_TMDB_TOKEN", "")
	t.Setenv("KAMEHOUSE_TMDB_API_KEY", "")
	logger := zerolog.Nop()
	for _, scanner := range []string{"anilist", "jikan", "tmdb", ""} {
		t.Run(scanner, func(t *testing.T) {
			settings := &models.Settings{}
			settings.Library.ScannerProvider = scanner
			settings.Library.TmdbApiKey = "configured-token"
			require.Equal(t, "tmdb", getActiveProvider(settings, nil, &logger).GetProviderID())
		})
	}
}

func TestEpisodeEnrichmentProviderTokenFallback(t *testing.T) {
	t.Setenv("KAMEHOUSE_TMDB_TOKEN", "configured-env-token")
	t.Setenv("KAMEHOUSE_TMDB_API_KEY", "")
	logger := zerolog.Nop()
	settings := &models.Settings{}
	settings.Library.ScannerProvider = "anilist"
	settings.Library.TmdbApiKey = "your_tmdb_bearer_token_here"
	require.Equal(t, "tmdb", getActiveProvider(settings, nil, &logger).GetProviderID())

	t.Setenv("KAMEHOUSE_TMDB_TOKEN", "")
	require.Equal(t, "jikan", getActiveProvider(settings, nil, &logger).GetProviderID())
}

func TestEpisodeEnrichmentSeasonCountIncludesDBZFinalSeason(t *testing.T) {
	// Season 1 has 39 episodes, but later seasons have different lengths.
	// The old estimate fetched only 8 seasons (253 of the 291 episodes).
	require.Equal(t, 9, episodeEnrichmentSeasonCount(291, 39, 9))
	require.Equal(t, 1, episodeEnrichmentSeasonCount(20, 0, 1))
	require.Equal(t, 8, episodeEnrichmentSeasonCount(291, 39, 0))
}
