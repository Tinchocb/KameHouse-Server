package torrentstream

import (
	"context"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/directstream"
	"kamehouse/internal/events"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/torrents/autoselect"
	"kamehouse/internal/torrents/torrent"
	"kamehouse/internal/util"
	"sync"

	atorrent "github.com/anacrolix/torrent"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

type TLSState string

const (
	TLSStateSearchingTorrents TLSState = "searching_torrents"
	TLSStateDownloading      TLSState = "downloading"
	TLSStateReady            TLSState = "ready"
)

// AutoDownloader is a placeholder for the actual AutoDownloader type
type AutoDownloader struct{}

func NewAutoDownloader(args ...interface{}) *AutoDownloader {
	return &AutoDownloader{}
}

func (a *AutoDownloader) Start(args ...interface{}) error { return nil }
func (a *AutoDownloader) SetSettings(s models.AutoDownloaderSettings) {}
func (a *AutoDownloader) CleanUpDownloadedItems() {}
func (a *AutoDownloader) Run(args ...interface{}) error { return nil }
func (a *AutoDownloader) RunCheck(args ...interface{}) error { return nil }
func (a *AutoDownloader) SetTorrentClientRepository(r interface{}) {}
func (a *AutoDownloader) GetSimulationResults() interface{} { return nil }
func (a *AutoDownloader) ClearSimulationResults() {}
func (a *AutoDownloader) isTitleMatch(args ...interface{}) bool { return false }
func (a *AutoDownloader) isSeasonAndEpisodeMatch(args ...interface{}) (bool, interface{}) { return false, nil }
func (a *AutoDownloader) isAdditionalTermsMatch(args ...interface{}) bool { return false }

type Repository struct {
	logger              *zerolog.Logger
	db                  *db.Database
	wsEventManager      events.WSEventManagerInterface
	autoSelect          *autoselect.AutoSelect
	torrentRepository   *torrent.Repository
	platformRef         *util.Ref[platform.Platform]
	metadataProviderRef *util.Ref[metadata_provider.Provider]
	settings            mo.Option[*models.TorrentstreamSettings]
	client              *atorrent.Client
	mu                  sync.Mutex
	// Internal client wrapper
	torrentClient       *Client
	// Reference to the direct stream manager for playing torrent streams
	directStreamManager *directstream.Manager
}

// InitModules initializes the torrent engine with the given settings.
// Called by core.App.InitOrRefreshTorrentstreamSettings().
func (r *Repository) InitModules(settings *models.TorrentstreamSettings) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.settings = mo.Some(settings)

	if !settings.Enabled {
		r.logger.Debug().Msg("torrentstream: Module disabled, skipping initialization")
		return nil
	}

	// Initialize the torrent client
	r.torrentClient = NewClient(r)
	if err := r.torrentClient.initializeClient(); err != nil {
		return fmt.Errorf("torrentstream: failed to initialize client: %w", err)
	}

	// Store the raw anacrolix client reference
	r.client = r.torrentClient.client

	r.logger.Info().Msg("torrentstream: Module initialized")
	return nil
}

// Shutdown gracefully shuts down the torrent engine.
func (r *Repository) Shutdown() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.torrentClient != nil {
		r.torrentClient.Shutdown()
		r.torrentClient = nil
	}
	r.client = nil

	r.logger.Info().Msg("torrentstream: Module shut down")
	return nil
}

// GetMediaInfo returns media info for the given media ID.
func (r *Repository) GetMediaInfo(ctx context.Context, id int) (interface{}, interface{}, error) {
	return nil, nil, nil
}


type NewRepositoryOptions struct {
	Logger              *zerolog.Logger
	DB                  *db.Database
	WSEventManager      events.WSEventManagerInterface
	AutoSelect          *autoselect.AutoSelect
	TorrentRepository   *torrent.Repository
	PlatformRef         *util.Ref[platform.Platform]
	MetadataProviderRef *util.Ref[metadata_provider.Provider]
	Settings            *models.TorrentstreamSettings
	BaseAnimeCache      interface{}
	CompleteAnimeCache  interface{}
	Database            *db.Database
	DirectStreamManager interface{}
}

func NewRepository(opts *NewRepositoryOptions) *Repository {
	// Type-assert the DirectStreamManager to *directstream.Manager
	var dsm *directstream.Manager
	if opts.DirectStreamManager != nil {
		if m, ok := opts.DirectStreamManager.(*directstream.Manager); ok {
			dsm = m
		}
	}

	return &Repository{
		logger:              opts.Logger,
		db:                  opts.DB,
		wsEventManager:      opts.WSEventManager,
		autoSelect:          opts.AutoSelect,
		torrentRepository:   opts.TorrentRepository,
		platformRef:         opts.PlatformRef,
		metadataProviderRef: opts.MetadataProviderRef,
		settings:            mo.None[*models.TorrentstreamSettings](),
		directStreamManager: dsm,
	}
}

func (r *Repository) Start() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	settings, ok := r.settings.Get()
	if !ok || !settings.Enabled {
		return nil
	}

	if r.torrentClient == nil {
		r.torrentClient = NewClient(r)
		if err := r.torrentClient.initializeClient(); err != nil {
			return err
		}
		r.client = r.torrentClient.client
	}

	return nil
}

func (r *Repository) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.torrentClient != nil {
		r.torrentClient.dropTorrents()
		r.torrentClient.cleanupCache()
	}

	return nil
}

func (r *Repository) GetStatus() *TorrentStreamStatus {
	r.mu.Lock()
	defer r.mu.Unlock()

	status := &TorrentStreamStatus{
		State: "stopped",
	}

	if r.torrentClient == nil || r.torrentClient.client == nil {
		return status
	}

	status.State = "idle"

	t, ok := r.torrentClient.currentTorrent.Get()
	if !ok || t == nil {
		return status
	}

	stats := t.Stats()
	status.State = "active"
	status.TotalPeers = stats.TotalPeers
	status.ActivePeers = stats.ActivePeers
	status.SeededPeers = stats.ConnectedSeeders

	if t.Info() != nil {
		file, fileOk := r.torrentClient.currentFile.Get()
		if fileOk && file != nil {
			status.TotalBytes = file.Length()
			status.FileName = file.DisplayPath()
			// Calculate download progress
			var completed int64
			fileFirstPiece := file.Offset() / t.Info().PieceLength
			fileLastPiece := (file.Offset() + file.Length() - 1) / t.Info().PieceLength
			for i := fileFirstPiece; i <= fileLastPiece; i++ {
				if int(i) < t.NumPieces() && t.Piece(int(i)).State().Complete {
					completed += t.Info().PieceLength
				}
			}
			if completed > status.TotalBytes {
				completed = status.TotalBytes
			}
			status.DownloadedBytes = completed
			if status.TotalBytes > 0 {
				status.ProgressPercentage = float64(completed) / float64(status.TotalBytes) * 100
			}
		}
	}

	// Download/upload speed from stats
	status.DownloadSpeed = stats.BytesReadUsefulData.Int64()
	status.UploadSpeed = stats.BytesWrittenData.Int64()

	return status
}

// TorrentStreamStatus contains the current state of the torrent stream engine.
type TorrentStreamStatus struct {
	State              string  `json:"state"`              // stopped, idle, active
	ProgressPercentage float64 `json:"progressPercentage"`
	TotalPeers         int     `json:"totalPeers"`
	ActivePeers        int     `json:"activePeers"`
	SeededPeers        int     `json:"seededPeers"`
	DownloadSpeed      int64   `json:"downloadSpeed"`      // bytes/s
	UploadSpeed        int64   `json:"uploadSpeed"`        // bytes/s
	DownloadedBytes    int64   `json:"downloadedBytes"`
	TotalBytes         int64   `json:"totalBytes"`
	FileName           string  `json:"fileName"`
}

func (r *Repository) PlayTorrent(ctx context.Context, media *platform.UnifiedMedia, episode int, torrent interface{}) error {
	return nil
}

func (r *Repository) sendStateEvent(state string, tlsState TLSState) {
}

const (
	eventLoading = "loading"
)
