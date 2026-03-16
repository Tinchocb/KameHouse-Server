package metadata_provider

import (
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"
	"testing"
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

func NewProvider(opts *NewProviderImplOptions) Provider {
	return &ProviderImpl{}
}

func GetFakeProvider(t *testing.T, database *db.Database) Provider {
	return &ProviderImpl{}
}

type NewProviderImplOptions struct {
	Config           *db.Database
	Logger           interface{}
	FileCacher       interface{}
	Database         interface{}
	ExtensionBankRef interface{}
}
