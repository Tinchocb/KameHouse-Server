package torrent

import (
	"context"

)

// AnimeSearchType describes the search strategy.
type AnimeSearchType string

const (
	AnimeSearchTypeSimple AnimeSearchType = "simple"
	AnimeSearchTypeSmart  AnimeSearchType = "smart"
)

// AnimeSearchOptions holds the parameters for a torrent search.
type AnimeSearchOptions struct {
	Provider                string
	Type                    AnimeSearchType
	Media                   interface{} // *platform.UnifiedMedia
	Query                   string
	Batch                   bool
	EpisodeNumber           int
	BestReleases            bool
	Resolution              string
	IncludeSpecialProviders bool
}

// TorrentItem represents a single torrent result.
type TorrentItem struct {
	Name     string `json:"name"`
	InfoHash string `json:"infoHash"`
}

// SearchPreviewEpisode is the episode metadata returned in a smart search preview.
type SearchPreviewEpisode struct {
	DisplayTitle string `json:"displayTitle"`
	Number       int    `json:"number"`
}

// SearchPreview is a single result item from a smart search, linking a torrent to an episode.
type SearchPreview struct {
	Torrent *TorrentItem          `json:"torrent"`
	Episode *SearchPreviewEpisode `json:"episode,omitempty"` // nil for batch
}

// SearchData is the result returned from a torrent search.
type SearchData struct {
	Torrents                  []TorrentItem                                    `json:"torrents"`
	Previews                  []*SearchPreview                                 `json:"previews,omitempty"`
}

// SearchAnime performs a torrent search for anime (stub).
func (r *Repository) SearchAnime(ctx context.Context, opts AnimeSearchOptions) (*SearchData, error) {
	return &SearchData{Torrents: []TorrentItem{}}, nil
}

func (r *Repository) SearchTorrents(ctx context.Context, provider string, query string) (*SearchData, error) {
	return nil, nil
}

func (r *Repository) SearchSmartTorrents(ctx context.Context, provider string, query string) (*SearchData, error) {
	return nil, nil
}
