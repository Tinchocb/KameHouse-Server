package continuity

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/util/filecache"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

const (
	MediastreamKind Kind = "mediastream"
)

type (
	// Manager is used to manage the user's viewing history across different media types.
	Manager struct {
		fileCacher                  *filecache.Cacher
		db                          *db.Database
		watchHistoryFileCacheBucket *filecache.Bucket

		TelemetryManager *TelemetryManager

		logger   *zerolog.Logger
		settings *Settings
		mu       sync.RWMutex
	}

	Settings struct {
		WatchContinuityEnabled bool
	}

	Kind string
)

type (
	NewManagerOptions struct {
		FileCacher *filecache.Cacher
		Logger     *zerolog.Logger
		Database   *db.Database
	}
)

// NewManager creates a new Manager, it should be initialized once.
func NewManager(opts *NewManagerOptions) *Manager {
	watchHistoryFileCacheBucket := filecache.NewBucket(WatchHistoryBucketName, time.Hour*24*99999)

	ret := &Manager{
		fileCacher:                  opts.FileCacher,
		logger:                      opts.Logger,
		db:                          opts.Database,
		watchHistoryFileCacheBucket: &watchHistoryFileCacheBucket,
		settings: &Settings{
			WatchContinuityEnabled: false,
		},
	}

	ret.logger.Info().Msg("continuity: Initialized manager")

	ret.TelemetryManager = NewTelemetryManager(ret, opts.Logger, 5*time.Second)

	return ret
}

// SetSettings should be called after initializing the Manager.
func (m *Manager) SetSettings(settings *Settings) {
	if m == nil || settings == nil {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.settings = settings
}

// GetSettings returns the current settings.
func (m *Manager) GetSettings() *Settings {
	if m == nil {
		return nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.settings
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
