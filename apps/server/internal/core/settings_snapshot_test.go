package core

import (
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models"
	"sync"
	"testing"
)

func TestFeatureRefreshPreservesExplicitRestrictions(t *testing.T) {
	l := zerolog.Nop()
	for _, flags := range []KameHouseFlags{
		{DisableFeatures: []FeatureKey{ManageLocalAnimeLibrary, WatchingLocalAnime}},
		{LockDown: true, DisableFeatures: []FeatureKey{ManageLocalAnimeLibrary}},
	} {
		m := NewFeatureManager(&l, flags)
		for _, disabled := range []bool{false, true, false} {
			m.UpdateFromSettings(&models.LibrarySettings{DisableLocalScanning: disabled})
			require.True(t, m.IsDisabled(ManageLocalAnimeLibrary))
			require.True(t, m.IsDisabled(WatchingLocalAnime))
		}
	}
}

func TestSettingsPublicationPinsIndependentGeneration(t *testing.T) {
	a := &App{}
	s := &models.Settings{Library: models.LibrarySettings{SeriesPaths: models.LibraryPaths{"first"}}}
	a.publishSettings(s)
	first := a.SettingsSnapshot()
	s.Library.SeriesPaths[0] = "caller-mutated"
	require.Equal(t, "first", first.Library.SeriesPaths[0])
	var workers sync.WaitGroup
	for i := 0; i < 4; i++ {
		workers.Go(func() {
			for j := 0; j < 200; j++ {
				a.publishSettings(&models.Settings{Library: models.LibrarySettings{SeriesPaths: models.LibraryPaths{"next"}}})
				a.publishMediastreamSettings(&models.MediastreamSettings{FfmpegPath: "ffmpeg"})
				_ = a.SettingsSnapshot().Library.SeriesPaths[0]
				_ = a.MediastreamSettingsSnapshot().FfmpegPath
			}
		})
	}
	workers.Wait()
	require.Equal(t, "first", first.Library.SeriesPaths[0])
}
