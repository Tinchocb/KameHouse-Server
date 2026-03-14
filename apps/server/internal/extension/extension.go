// Package extension provides the extension bank and extension types for the KameHouse plugin system.
package extension

import hibiketorrent "kamehouse/internal/extension/hibike/torrent"

// ExtensionType identifies the kind of extension.
type ExtensionType string

const (
	TypeAnimeTorrentProvider ExtensionType = "anime-torrent-provider"
)

// Extension is the base metadata for any extension.
type Extension struct {
	ID   string
	Type ExtensionType
	Name string
}

// AnimeTorrentProviderExtension wraps a hibike AnimeProvider with extension metadata.
type AnimeTorrentProviderExtension struct {
	Extension *Extension
	Provider  hibiketorrent.AnimeProvider
}

// NewAnimeTorrentProviderExtension creates a new AnimeTorrentProviderExtension.
func NewAnimeTorrentProviderExtension(ext *Extension, provider hibiketorrent.AnimeProvider) *AnimeTorrentProviderExtension {
	return &AnimeTorrentProviderExtension{Extension: ext, Provider: provider}
}

// UnifiedBank holds all registered extensions keyed by their ID.
type UnifiedBank struct {
	extensions map[string]interface{}
}

// NewUnifiedBank creates an empty UnifiedBank.
func NewUnifiedBank() *UnifiedBank {
	return &UnifiedBank{extensions: make(map[string]interface{})}
}

// Set registers an extension under the given ID.
func (b *UnifiedBank) Set(id string, ext interface{}) {
	b.extensions[id] = ext
}

// Get retrieves an extension by ID. Returns nil and false if not found.
func (b *UnifiedBank) Get(id string) (interface{}, bool) {
	ext, ok := b.extensions[id]
	return ext, ok
}

// GetAnimeTorrentProvider returns the anime torrent provider extension for a given ID, if registered.
func (b *UnifiedBank) GetAnimeTorrentProvider(id string) (*AnimeTorrentProviderExtension, bool) {
	ext, ok := b.extensions[id]
	if !ok {
		return nil, false
	}
	p, ok := ext.(*AnimeTorrentProviderExtension)
	return p, ok
}

// GetAllAnimeTorrentProviders returns all registered anime torrent provider extensions.
func (b *UnifiedBank) GetAllAnimeTorrentProviders() []*AnimeTorrentProviderExtension {
	var result []*AnimeTorrentProviderExtension
	for _, ext := range b.extensions {
		if p, ok := ext.(*AnimeTorrentProviderExtension); ok {
			result = append(result, p)
		}
	}
	return result
}
