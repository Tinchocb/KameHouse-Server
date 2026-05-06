package core

import (
	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
)

type (
	FeatureKey     string
	FeatureManager struct {
		disabledFeatures map[FeatureKey]bool
		DisabledFeatures []FeatureKey
		logger           *zerolog.Logger
	}
)

const (
	// ManageOfflineMode allows switching to offline mode.
	ManageOfflineMode FeatureKey = "ManageOfflineMode"
	// ViewSettings allows viewing the settings page.
	ViewSettings FeatureKey = "ViewSettings"
	// ViewLogs allows viewing the logs.
	ViewLogs FeatureKey = "ViewLogs"
	// UpdateSettings allows updating the settings.
	UpdateSettings FeatureKey = "UpdateSettings"
	// ManageLocalAnimeLibrary encompasses all updates to the local anime library.
	//	- Refreshing library, update local files, opening directory etc.
	ManageLocalAnimeLibrary FeatureKey = "ManageLocalAnimeLibrary"
	// ManageAccount allows logging in and out of the user account.
	ManageAccount FeatureKey = "ManageAccount"
	// ViewAccount allows viewing the user account info.
	ViewAccount FeatureKey = "ViewAccount"
	// ManageLists allows managing Platform/Custom source/Local lists.
	//	- Adding/updating/removing entries
	ManageLists FeatureKey = "ManageLists"
	// RefreshMetadata allows refreshing anime metadata from Platform and custom sources.
	RefreshMetadata      FeatureKey = "RefreshMetadata"
	WatchingLocalAnime   FeatureKey = "WatchingLocalAnime"
	Proxy             FeatureKey = "Proxy"
	PushRequests      FeatureKey = "PushRequests"
)

func NewFeatureManager(logger *zerolog.Logger, flags KameHouseFlags) *FeatureManager {
	ret := &FeatureManager{
		disabledFeatures: make(map[FeatureKey]bool),
		DisabledFeatures: flags.DisableFeatures,
		logger:           logger,
	}

	if flags.LockDown {
		ret.DisabledFeatures = []FeatureKey{
			ManageOfflineMode,
			ViewSettings,
			ViewLogs,
			UpdateSettings,
			RefreshMetadata,
			WatchingLocalAnime,
			Proxy,
			PushRequests,
		}
	}

	for _, key := range ret.DisabledFeatures {
		ret.disabledFeatures[key] = true
	}

	if len(ret.DisabledFeatures) > 0 {
		logger.Warn().Msgf("app: Disabled features: %s", ret.DisabledFeatures)
	}

	return ret
}

func (m *FeatureManager) IsEnabled(key FeatureKey) bool {
	_, ok := m.disabledFeatures[key]
	return !ok
}

func (m *FeatureManager) IsDisabled(key FeatureKey) bool {
	_, ok := m.disabledFeatures[key]
	return ok
}

func (m *FeatureManager) HasDisabledFeatures() bool {
	return len(m.DisabledFeatures) > 0
}

func (m *FeatureManager) GetDisabledFeatureMap() map[FeatureKey]bool {
	return m.disabledFeatures
}

// UpdateFromSettings updates the disabled features based on the user's library settings.
// This allows users to disable services from the Settings UI.
func (m *FeatureManager) UpdateFromSettings(library *models.LibrarySettings) {
	if library == nil {
		return
	}

	type toggle struct {
		disabled bool
		keys     []FeatureKey
	}

	toggles := []toggle{
		{library.DisableLocalScanning, []FeatureKey{ManageLocalAnimeLibrary, WatchingLocalAnime}},
	}

	for _, t := range toggles {
		for _, key := range t.keys {
			if t.disabled {
				m.disabledFeatures[key] = true
			} else {
				delete(m.disabledFeatures, key)
			}
		}
	}

	// Rebuild the DisabledFeatures slice
	m.DisabledFeatures = make([]FeatureKey, 0, len(m.disabledFeatures))
	for key := range m.disabledFeatures {
		m.DisabledFeatures = append(m.DisabledFeatures, key)
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type (
	FeatureFlags struct {
	}

)

// NewFeatureFlags initializes the feature flags
func NewFeatureFlags(cfg *Config, logger *zerolog.Logger) FeatureFlags {
	return FeatureFlags{}
}
