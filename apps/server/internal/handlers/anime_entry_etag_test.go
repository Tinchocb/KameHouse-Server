package handlers

import (
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"

	"github.com/stretchr/testify/require"
)

func TestAnimeEntryETagChangesWhenEpisodeEnrichmentArrives(t *testing.T) {
	entry := &anime.Entry{
		MediaID:  12971,
		Media:    &models.LibraryMedia{},
		Episodes: []*anime.Episode{{EpisodeMetadata: &anime.EpisodeMetadata{Title: "Episode"}}},
	}
	cold := getAnimeEntryETag(entry)
	require.Equal(t, cold, getAnimeEntryETag(entry))
	entry.Episodes[0].EpisodeMetadata.Overview = "Episode synopsis"
	summary := getAnimeEntryETag(entry)
	require.NotEqual(t, cold, summary)
	entry.Episodes[0].EpisodeMetadata.Image = "https://image.tmdb.org/t/p/w500/frame.jpg"
	require.NotEqual(t, summary, getAnimeEntryETag(entry))
}
