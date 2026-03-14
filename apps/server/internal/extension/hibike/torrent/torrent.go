// Package torrent defines the hibike anime torrent provider interface and types.
package torrent

// AnimeTorrent represents a single anime torrent result from any provider.
type AnimeTorrent struct {
	Name        string  `json:"name"`
	InfoHash    string  `json:"infoHash"`
	MagnetLink  string  `json:"magnetLink"`
	Seeders     int     `json:"seeders"`
	Leechers    int     `json:"leechers"`
	Size        int64   `json:"size"`
	IsBatch     bool    `json:"isBatch"`
	EpisodeNumber int   `json:"episodeNumber,omitempty"`
	ReleaseGroup  string `json:"releaseGroup,omitempty"`
	Resolution    string `json:"resolution,omitempty"`
	Provider    string  `json:"provider,omitempty"`
}

// AnimeSearchOptions holds parameters for a regular torrent search.
type AnimeSearchOptions struct {
	Query      string
	Episode    int
	Resolution string
	Batch      bool
}

// AnimeSmartSearchOptions holds parameters for a smart (structured) torrent search.
type AnimeSmartSearchOptions struct {
	Media      interface{} // *anilist.BaseAnime or similar
	Query      string
	Episode    int
	Resolution string
	Batch      bool
}

// AnimeProviderSettings describes the capabilities of a torrent provider.
type AnimeProviderSettings struct {
	CanSmartSearch     bool
	SmartSearchFilters []string
	SupportsAdult      bool
	Type               string
}

// AnimeProvider is the interface that all hibike torrent providers must implement.
type AnimeProvider interface {
	Search(opts AnimeSearchOptions) ([]*AnimeTorrent, error)
	SmartSearch(opts AnimeSmartSearchOptions) ([]*AnimeTorrent, error)
	GetTorrentInfoHash(torrent *AnimeTorrent) (string, error)
	GetTorrentMagnetLink(torrent *AnimeTorrent) (string, error)
	GetLatest() ([]*AnimeTorrent, error)
	GetSettings() AnimeProviderSettings
}
