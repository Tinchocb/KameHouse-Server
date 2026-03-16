package torrentstream

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
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
}

func (r *Repository) InitModules(settings *models.TorrentstreamSettings) error { return nil }
func (r *Repository) Shutdown() error { return nil }
func (r *Repository) GetMediaInfo(ctx context.Context, id int) (interface{}, interface{}, error) { return nil, nil, nil }


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
	return &Repository{
		logger:              opts.Logger,
		db:                  opts.DB,
		wsEventManager:      opts.WSEventManager,
		autoSelect:          opts.AutoSelect,
		torrentRepository:   opts.TorrentRepository,
		platformRef:         opts.PlatformRef,
		metadataProviderRef: opts.MetadataProviderRef,
		settings:            mo.Some(opts.Settings),
	}
}

func (r *Repository) Start() error {
	return nil
}

func (r *Repository) Stop() error {
	return nil
}

func (r *Repository) GetStatus() string {
	return "stopped"
}

func (r *Repository) PlayTorrent(ctx context.Context, media *platform.UnifiedMedia, episode int, torrent interface{}) error {
	return nil
}

func (r *Repository) sendStateEvent(state string, tlsState TLSState) {
}

const (
	eventLoading = "loading"
)
