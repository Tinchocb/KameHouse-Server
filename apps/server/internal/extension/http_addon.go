package extension

import (
	"context"
)

// HTTPAddonManifest defines the configuration and capabilities of an HTTP Addon.
// It is fetched from the addon's /manifest.json endpoint.
type HTTPAddonManifest struct {
	ID          string    `json:"id"`
	Version     string    `json:"version"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon,omitempty"`
	Types       []string  `json:"types"`                // e.g. "anime", "manga", "movie"
	IDPrefixes  []string  `json:"idPrefixes,omitempty"` // e.g. ["anilist:", "myanimelist:"]
	Catalogs    []Catalog `json:"catalogs,omitempty"`
}

// Catalog describes a browsable collection exposed by the addon.
type Catalog struct {
	Type string `json:"type"` // e.g. "anime"
	ID   string `json:"id"`   // e.g. "top-airing"
	Name string `json:"name,omitempty"`
}

// HTTPAddonStream represents a single video/torrent stream returned by the addon.
type HTTPAddonStream struct {
	Name          string                 `json:"name,omitempty"`
	Title         string                 `json:"title,omitempty"`
	URL           string                 `json:"url,omitempty"`           // Direct video link
	InfoHash      string                 `json:"infoHash,omitempty"`      // Torrent info hash
	BehaviorHints map[string]interface{} `json:"behaviorHints,omitempty"` // Optional hints (notWebReady, bingeGroup, etc.)
}

// HTTPAddonProvider is the interface that all HTTP-based addon clients must implement.
type HTTPAddonProvider interface {
	// GetManifest fetches the addon's manifest from /manifest.json.
	GetManifest(ctx context.Context) (*HTTPAddonManifest, error)

	// GetStreams fetches available streams from the addon for a given content type and ID.
	// contentType is e.g. "anime", "movie". id is the media identifier (e.g. "anilist:12345").
	// The addon is expected to respond from /stream/{type}/{id}.json
	GetStreams(ctx context.Context, contentType string, id string) ([]HTTPAddonStream, error)
}
