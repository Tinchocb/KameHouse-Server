package core

import (
	"kamehouse/internal/api/metadata_provider"

	"github.com/spf13/viper"
)

// SetOfflineMode changes the offline mode.
func (a *App) SetOfflineMode(enabled bool) {
	// Update the config
	a.Config.Server.Offline = enabled
	viper.Set("server.offline", enabled)
	err := viper.WriteConfig()
	if err != nil {
		a.Logger.Err(err).Msg("app: Failed to write config after setting offline mode")
	}
	a.Logger.Info().Bool("enabled", enabled).Msg("app: Offline mode set")
	a.isOfflineRef.Set(enabled)

	if a.Metadata.ProviderRef.IsPresent() {
		a.Metadata.ProviderRef.Get().Close()
	}

	// Update the platform and metadata provider
	if enabled {
		a.Metadata.ProviderRef.Set(a.LocalManager.GetOfflineMetadataProvider())
	} else {
		a.Metadata.ProviderRef.Set(metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
			Logger:     a.Logger,
			FileCacher: a.FileCacher,
			Database:   a.Database,
		}))
	}

	a.InitOrRefreshModules()
}
