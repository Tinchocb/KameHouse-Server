package extension

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// httpAddonClient is the concrete implementation of HTTPAddonProvider.
// It communicates with a remote addon via standard HTTP/JSON endpoints.
type httpAddonClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPAddonClient creates a new HTTP addon client for the given base URL.
// The base URL should point to the root of the addon (e.g. "https://my-addon.example.com").
//
// Network error handling:
//   - All requests use a 15-second timeout to prevent the server from hanging on slow addons.
//   - Context cancellation is supported through http.NewRequestWithContext.
//   - Non-200 status codes are treated as errors with the status code included in the message.
func NewHTTPAddonClient(baseURL string) HTTPAddonProvider {
	return &httpAddonClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// GetManifest fetches and parses the addon's manifest from /manifest.json.
func (c *httpAddonClient) GetManifest(ctx context.Context) (*HTTPAddonManifest, error) {
	url := fmt.Sprintf("%s/manifest.json", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("http_addon: failed to create manifest request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http_addon: network error fetching manifest from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http_addon: unexpected status %d fetching manifest from %s", resp.StatusCode, url)
	}

	var manifest HTTPAddonManifest
	if err := json.NewDecoder(resp.Body).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("http_addon: failed to decode manifest JSON: %w", err)
	}

	return &manifest, nil
}

// GetStreams fetches streams from /stream/{type}/{id}.json.
// Returns an empty slice (not an error) if the addon has no streams for the given content.
func (c *httpAddonClient) GetStreams(ctx context.Context, contentType string, id string) ([]HTTPAddonStream, error) {
	url := fmt.Sprintf("%s/stream/%s/%s.json", c.baseURL, contentType, id)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("http_addon: failed to create streams request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http_addon: network error fetching streams from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// Addon does not have streams for this content — this is not an error
		return []HTTPAddonStream{}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http_addon: unexpected status %d fetching streams from %s", resp.StatusCode, url)
	}

	// The Stremio protocol wraps streams in {"streams": [...]}
	var response struct {
		Streams []HTTPAddonStream `json:"streams"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("http_addon: failed to decode streams JSON: %w", err)
	}

	return response.Streams, nil
}
