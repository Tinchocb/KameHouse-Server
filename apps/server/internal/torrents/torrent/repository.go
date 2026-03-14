package torrent

import (
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/util"
	"sync"

	"github.com/rs/zerolog"
)

// RepositorySettings holds runtime configuration for the torrent repository.
type RepositorySettings struct {
	DefaultAnimeProvider string
}

type Repository struct {
	logger              *zerolog.Logger
	db                  *db.Database
	metadataProviderRef *util.Ref[metadata_provider.Provider]
	extensionBankRef    interface{}
	settings            RepositorySettings
	mu                  sync.Mutex
}

type NewRepositoryOptions struct {
	Logger              *zerolog.Logger
	Database            *db.Database
	MetadataProviderRef *util.Ref[metadata_provider.Provider]
	ExtensionBankRef    interface{}
}

func NewRepository(opts *NewRepositoryOptions) *Repository {
	return &Repository{
		logger:              opts.Logger,
		db:                  opts.Database,
		metadataProviderRef: opts.MetadataProviderRef,
		extensionBankRef:    opts.ExtensionBankRef,
	}
}

// SetSettings updates the repository runtime configuration.
func (r *Repository) SetSettings(s *RepositorySettings) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if s != nil {
		r.settings = *s
	}
}

// GetAnimeProviderExtension returns a torrent provider extension by provider ID.
func (r *Repository) GetAnimeProviderExtension(providerID string) (interface{}, bool) {
	return nil, false
}

// GetDefaultAnimeProvider returns the configured default anime torrent provider ID.
func (r *Repository) GetDefaultAnimeProvider() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.settings.DefaultAnimeProvider
}
