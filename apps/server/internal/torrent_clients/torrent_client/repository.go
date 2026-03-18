package torrent_client

import (
	"context"
	"errors"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/events"
	"kamehouse/internal/torrents/torrent"
	"kamehouse/internal/util"
	"time"

	"github.com/rs/zerolog"
)

const (
	QbittorrentClient  = "qbittorrent"
	TransmissionClient = "transmission"
	NoneClient         = "none"
)

type (
	Repository struct {
		logger                      *zerolog.Logger
		torrentRepository           *torrent.Repository
		provider                    string
		metadataProviderRef         *util.Ref[metadata_provider.Provider]
		activeTorrentCountCtxCancel context.CancelFunc
		activeTorrentCount          *ActiveCount
	}

	// NewRepositoryOptions describes the parameters for creating a new repository.
	// Fields for qBittorrent and Transmission have been removed as third-party integrations are no longer supported.
	NewRepositoryOptions struct {
		Logger              *zerolog.Logger
		TorrentRepository   *torrent.Repository
		Provider            string
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
	}

	ActiveCount struct {
		Downloading int `json:"downloading"`
		Seeding     int `json:"seeding"`
		Paused      int `json:"paused"`
	}
)

func NewRepository(opts *NewRepositoryOptions) *Repository {
	if opts.Provider == "" {
		opts.Provider = NoneClient
	}
	return &Repository{
		logger:              opts.Logger,
		torrentRepository:   opts.TorrentRepository,
		provider:            opts.Provider,
		metadataProviderRef: opts.MetadataProviderRef,
		activeTorrentCount:  &ActiveCount{},
	}
}

func (r *Repository) Shutdown() {
	if r.activeTorrentCountCtxCancel != nil {
		r.activeTorrentCountCtxCancel()
		r.activeTorrentCountCtxCancel = nil
	}
}

func (r *Repository) InitActiveTorrentCount(enabled bool, wsEventManager events.WSEventManagerInterface) {
	if r.activeTorrentCountCtxCancel != nil {
		r.activeTorrentCountCtxCancel()
	}

	if !enabled {
		return
	}

	var ctx context.Context
	ctx, r.activeTorrentCountCtxCancel = context.WithCancel(context.Background())
	go func(ctx context.Context) {
		ticker := time.NewTicker(time.Second * 5)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				r.GetActiveCount(r.activeTorrentCount)
				wsEventManager.SendEvent(events.ActiveTorrentCountUpdated, r.activeTorrentCount)
			}
		}
	}(ctx)
}

func (r *Repository) GetProvider() string {
	return r.provider
}

func (r *Repository) Start() bool {
	return true
}

func (r *Repository) TorrentExists(hash string) bool {
	return false
}

type GetListOptions struct {
	Category *string
	Sort     string
}

func (r *Repository) GetList(opts *GetListOptions) ([]*Torrent, error) {
	return []*Torrent{}, nil
}

func (r *Repository) GetActiveCount(ret *ActiveCount) {
	ret.Seeding = 0
	ret.Downloading = 0
	ret.Paused = 0
}

func (r *Repository) GetActiveTorrents(opts *GetListOptions) ([]*Torrent, error) {
	return []*Torrent{}, nil
}

func (r *Repository) AddMagnets(magnets []string, dest string) error {
	return errors.New("torrent client: External torrent clients are not supported")
}

func (r *Repository) RemoveTorrents(hashes []string) error {
	return nil
}

func (r *Repository) PauseTorrents(hashes []string) error {
	return nil
}

func (r *Repository) ResumeTorrents(hashes []string) error {
	return nil
}

func (r *Repository) DeselectFiles(hash string, indices []int) error {
	return nil
}

func (r *Repository) GetFiles(hash string) (filenames []string, err error) {
	return []string{}, nil
}
