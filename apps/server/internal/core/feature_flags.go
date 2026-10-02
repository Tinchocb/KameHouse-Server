package core

import (
	"sync"

	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
)

type (
	FeatureKey     string
	FeatureManager struct {
		// mu protege disabledFeatures y DisabledFeatures: UpdateFromSettings corre
		// al refrescar los módulos mientras los handlers llaman a IsDisabled, y un
		// map leído y escrito a la vez tumba el proceso.
		mu               sync.RWMutex
		disabledFeatures map[FeatureKey]bool
		DisabledFeatures []FeatureKey
		logger           *zerolog.Logger
	}
)

const (
	// ViewSettings allows viewing the settings page.
	ViewSettings FeatureKey = "ViewSettings"
	// ViewLogs allows viewing the logs.
	ViewLogs FeatureKey = "ViewLogs"
	// UpdateSettings allows updating the settings.
	UpdateSettings FeatureKey = "UpdateSettings"
	// ManageLocalAnimeLibrary encompasses all updates to the local anime library.
	//	- Refreshing library, update local files, opening directory etc.
	ManageLocalAnimeLibrary FeatureKey = "ManageLocalAnimeLibrary"
	// ManageLists allows managing Platform/Custom source/Local lists.
	//	- Adding/updating/removing entries
	ManageLists FeatureKey = "ManageLists"
	// RefreshMetadata allows refreshing anime metadata from Platform and custom sources.
	RefreshMetadata    FeatureKey = "RefreshMetadata"
	WatchingLocalAnime FeatureKey = "WatchingLocalAnime"
	Proxy              FeatureKey = "Proxy"
)

func NewFeatureManager(logger *zerolog.Logger, flags KameHouseFlags) *FeatureManager {
	ret := &FeatureManager{
		disabledFeatures: make(map[FeatureKey]bool),
		DisabledFeatures: flags.DisableFeatures,
		logger:           logger,
	}

	if flags.LockDown {
		ret.DisabledFeatures = []FeatureKey{
			ViewSettings,
			ViewLogs,
			UpdateSettings,
			RefreshMetadata,
			WatchingLocalAnime,
			Proxy,
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

func (m *FeatureManager) IsDisabled(key FeatureKey) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.disabledFeatures[key]
	return ok
}

func (m *FeatureManager) HasDisabledFeatures() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.DisabledFeatures) > 0
}

// GetDisabledFeatures devuelve una copia de la lista, segura de leer mientras
// UpdateFromSettings la reconstruye.
func (m *FeatureManager) GetDisabledFeatures() []FeatureKey {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]FeatureKey, len(m.DisabledFeatures))
	copy(out, m.DisabledFeatures)
	return out
}

// UpdateFromSettings updates the disabled features based on the user's library settings.
// This allows users to disable services from the Settings UI.
func (m *FeatureManager) UpdateFromSettings(library *models.LibrarySettings) {
	if library == nil {
		return
	}

	// DisableLocalScanning ya no apaga features: bloqueaba /api/v1/mediastream, que
	// también reproduce Google Drive. El escaneo lo cortan el AutoScanner, el watcher
	// y HandleScanLocalFiles; la vista oculta los archivos locales (visibleLocalFiles).
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.disabledFeatures, ManageLocalAnimeLibrary)
	delete(m.disabledFeatures, WatchingLocalAnime)

	// Rebuild the DisabledFeatures slice
	m.DisabledFeatures = make([]FeatureKey, 0, len(m.disabledFeatures))
	for key := range m.disabledFeatures {
		m.DisabledFeatures = append(m.DisabledFeatures, key)
	}
}

// ─────────────────────────────────────────────────────────────────────────────

type (
	FeatureFlags struct {
	}
)

// NewFeatureFlags initializes the feature flags
func NewFeatureFlags(cfg *Config, logger *zerolog.Logger) FeatureFlags {
	return FeatureFlags{}
}
