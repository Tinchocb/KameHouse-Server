package metadata_provider

import (
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"
	"testing"

	"github.com/rs/zerolog"
)

type Provider interface {
	GetAnimeMetadata(id int) (*metadata.AnimeMetadata, error)
	GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *metadata.AnimeMetadata) AnimeMetadataWrapper
	SetUseFallbackProvider(v bool)
	ClearCache()
	Close() error
}

type AnimeMetadataWrapper interface {
	GetEpisodeMetadata(ep string) metadata.EpisodeMetadata
}

type ProviderImpl struct {
}

func (p *ProviderImpl) GetAnimeMetadata(id int) (*metadata.AnimeMetadata, error) {
	return nil, nil
}

func (p *ProviderImpl) GetAnimeMetadataWrapper(baseAnime *platform.UnifiedMedia, animeMetadata *metadata.AnimeMetadata) AnimeMetadataWrapper {
	return nil
}

func (p *ProviderImpl) SetUseFallbackProvider(v bool) {}
func (p *ProviderImpl) ClearCache()                   {}
func (p *ProviderImpl) Close() error                  { return nil }

// NewProviderImplOptions configures the metadata provider.
// If TMDBClient is set, returns a real TMDB-backed provider.
// Otherwise returns the no-op stub.
type NewProviderImplOptions struct {
	Database         *db.Database
	Logger           *zerolog.Logger
	FileCacher       interface{}
	ExtensionBankRef interface{}
	// If set, enables real episode metadata enrichment via TMDB.
	TMDBClient *tmdb.Client
}

func NewProvider(opts *NewProviderImplOptions) Provider {
	if opts != nil && opts.TMDBClient != nil {
		return NewTMDBProviderImpl(opts.TMDBClient, opts.Database, opts.Logger)
	}
	return &ProviderImpl{}
}

func GetFakeProvider(t *testing.T, database *db.Database) Provider {
	return &ProviderImpl{}
}
