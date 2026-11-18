package core

import (
	"kamehouse/internal/database/models"
	"slices"
)

// SettingsSnapshot is an immutable generation. Readers pin it once per operation.
func (a *App) SettingsSnapshot() *models.Settings { return a.settingsSnapshot.Load() }
func (a *App) MediastreamSettingsSnapshot() *models.MediastreamSettings {
	return a.mediastreamSettingsSnapshot.Load()
}

func (a *App) publishSettings(settings *models.Settings) {
	copy := *settings
	copy.Library.SeriesPaths = slices.Clone(settings.Library.SeriesPaths)
	copy.Library.MoviePaths = slices.Clone(settings.Library.MoviePaths)
	// Separate-table settings have their own publication path.
	copy.Mediastream, copy.Theme = nil, nil
	a.settingsSnapshot.Store(&copy)
}

func (a *App) publishMediastreamSettings(settings *models.MediastreamSettings) {
	copy := *settings
	a.mediastreamSettingsSnapshot.Store(&copy)
}
