package core

import (
	"kamehouse/internal/api/metadata_provider"

	"github.com/spf13/viper"
)

// SetOfflineMode cambia el modo offline.
func (a *App) SetOfflineMode(enabled bool) {
	a.Config.Server.Offline = enabled
	viper.Set("server.offline", enabled)
	err := viper.WriteConfig()
	if err != nil {
		a.Logger.Err(err).Msg("app: Failed to write config after setting offline mode")
	}
	a.Logger.Info().Bool("enabled", enabled).Msg("app: Offline mode set")
	a.isOffline.Store(enabled)

	a.Metadata.Provider.Close()

	if enabled {
		a.Metadata.Provider.SetProvider(a.LocalManager.GetOfflineMetadataProvider())
	} else {
		a.Metadata.Provider.SetProvider(metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
			Logger:     a.Logger,
			FileCacher: a.FileCacher,
			Database:   a.Database,
		}))
	}

	a.InitOrRefreshModules()
}
