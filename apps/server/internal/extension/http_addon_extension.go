package extension

import (
	"context"
	"fmt"
	"sync"

	"github.com/rs/zerolog"
)

// HTTPAddonExtension wraps an HTTPAddonProvider as a BaseExtension
// so it can be registered in the UnifiedBank alongside native extensions.
type HTTPAddonExtension interface {
	BaseExtension
	GetHTTPAddonProvider() HTTPAddonProvider
	GetHTTPAddonManifest() *HTTPAddonManifest
}

type HTTPAddonExtensionImpl struct {
	ext      *Extension
	provider HTTPAddonProvider
	manifest *HTTPAddonManifest
	mu       sync.RWMutex
}

// NewHTTPAddonExtension creates an extension wrapper from an addon URL.
// It fetches the manifest eagerly so the extension metadata is immediately available.
func NewHTTPAddonExtension(addonURL string, logger *zerolog.Logger) (HTTPAddonExtension, error) {
	client := NewHTTPAddonClient(addonURL)

	// Fetch manifest to populate extension metadata
	manifest, err := client.GetManifest(context.Background())
	if err != nil {
		return nil, fmt.Errorf("http_addon: failed to load addon from %s: %w", addonURL, err)
	}

	ext := &Extension{
		ID:          manifest.ID,
		Name:        manifest.Name,
		Version:     manifest.Version,
		Description: manifest.Description,
		Icon:        manifest.Icon,
		ManifestURI: addonURL + "/manifest.json",
		Language:    "go", // HTTP client is implemented in Go
		Type:        TypeHTTPAddon,
		Author:      "HTTP Addon",
		Lang:        "multi",
	}

	logger.Info().
		Str("id", manifest.ID).
		Str("name", manifest.Name).
		Str("url", addonURL).
		Strs("types", manifest.Types).
		Msg("http_addon: Loaded HTTP addon")

	return &HTTPAddonExtensionImpl{
		ext:      ext,
		provider: client,
		manifest: manifest,
	}, nil
}

func (h *HTTPAddonExtensionImpl) GetHTTPAddonProvider() HTTPAddonProvider {
	return h.provider
}

func (h *HTTPAddonExtensionImpl) GetHTTPAddonManifest() *HTTPAddonManifest {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.manifest
}

// --- BaseExtension interface ---

func (h *HTTPAddonExtensionImpl) GetID() string              { return h.ext.ID }
func (h *HTTPAddonExtensionImpl) GetName() string            { return h.ext.Name }
func (h *HTTPAddonExtensionImpl) GetVersion() string         { return h.ext.Version }
func (h *HTTPAddonExtensionImpl) GetManifestURI() string     { return h.ext.ManifestURI }
func (h *HTTPAddonExtensionImpl) GetLanguage() Language      { return h.ext.Language }
func (h *HTTPAddonExtensionImpl) GetType() Type              { return h.ext.Type }
func (h *HTTPAddonExtensionImpl) GetDescription() string     { return h.ext.Description }
func (h *HTTPAddonExtensionImpl) GetNotes() string           { return h.ext.Notes }
func (h *HTTPAddonExtensionImpl) GetAuthor() string          { return h.ext.Author }
func (h *HTTPAddonExtensionImpl) GetPayload() string         { return "" }
func (h *HTTPAddonExtensionImpl) GetPayloadURI() string      { return "" }
func (h *HTTPAddonExtensionImpl) GetLang() string            { return h.ext.Lang }
func (h *HTTPAddonExtensionImpl) GetIcon() string            { return h.ext.Icon }
func (h *HTTPAddonExtensionImpl) GetWebsite() string         { return h.ext.Website }
func (h *HTTPAddonExtensionImpl) GetReadme() string          { return h.ext.Readme }
func (h *HTTPAddonExtensionImpl) GetPermissions() []string   { return nil }
func (h *HTTPAddonExtensionImpl) GetUserConfig() *UserConfig { return nil }
func (h *HTTPAddonExtensionImpl) GetSavedUserConfig() *SavedUserConfig {
	return h.ext.SavedUserConfig
}
func (h *HTTPAddonExtensionImpl) GetIsDevelopment() bool             { return false }
func (h *HTTPAddonExtensionImpl) GetPluginManifest() *PluginManifest { return nil }
