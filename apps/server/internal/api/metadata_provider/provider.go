package metadata_provider

import (
	"kamehouse/internal/api/jikan"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"
	"strconv"
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
	return NewSimpleAnimeMetadataWrapper(animeMetadata)
}

func (p *ProviderImpl) SetUseFallbackProvider(v bool) {}
func (p *ProviderImpl) ClearCache()                   {}
func (p *ProviderImpl) Close() error                  { return nil }

// ─── SimpleAnimeMetadataWrapper ──────────────────────────────────────────────
// A lightweight, flat wrapper that looks up episode metadata by plain episode number.
// It is used by TMDB, Jikan, and AniList providers whose metadata map uses
// plain string keys ("77") rather than composite keys.
type SimpleAnimeMetadataWrapper struct {
	metadata *metadata.AnimeMetadata
}

func NewSimpleAnimeMetadataWrapper(am *metadata.AnimeMetadata) AnimeMetadataWrapper {
	return &SimpleAnimeMetadataWrapper{metadata: am}
}

func (w *SimpleAnimeMetadataWrapper) GetEpisodeMetadata(ep string) metadata.EpisodeMetadata {
	if w == nil || w.metadata == nil {
		return metadata.EpisodeMetadata{}
	}
	// Direct key lookup (e.g., "77")
	if epMeta, found := w.metadata.FindEpisode(ep); found {
		return *epMeta
	}
	// Fallback: search by EpisodeNumber if ep is a numeric string
	epNum, err := strconv.Atoi(ep)
	if err != nil {
		return metadata.EpisodeMetadata{}
	}
	for _, epMeta := range w.metadata.Episodes {
		if epMeta.EpisodeNumber == epNum {
			return *epMeta
		}
	}
	return metadata.EpisodeMetadata{}
}

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
		// Use Jikan as primary provider with TMDB as a fallback for images
		jikanClient := jikan.NewClient(opts.Logger)
		return NewJikanProviderImpl(jikanClient, opts.Database, opts.Logger, opts.TMDBClient)
	}
	return &ProviderImpl{}
}

func GetFakeProvider(t *testing.T, database *db.Database) Provider {
	return &ProviderImpl{}
}
