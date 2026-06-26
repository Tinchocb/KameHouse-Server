package jellyfin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// Client es un cliente HTTP para la API de Jellyfin.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	logger     *zerolog.Logger
}

// NewClient crea un nuevo cliente de Jellyfin.
func NewClient(baseURL, apiKey string, logger *zerolog.Logger) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		logger: logger,
	}
}

// IsConfigured retorna true si el cliente tiene URL y API key configurados.
func (c *Client) IsConfigured() bool {
	return c.baseURL != "" && c.apiKey != ""
}

// SearchByTMDB busca un item en Jellyfin por su TMDB ID.
func (c *Client) SearchByTMDB(ctx context.Context, tmdbID int) (*JellyfinItem, error) {
	url := fmt.Sprintf("%s/Items?TmdbId=%d&Limit=1", c.baseURL, tmdbID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: failed to create request: %w", err)
	}
	req.Header.Set("X-Emby-Token", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jellyfin: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result JellyfinItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("jellyfin: failed to decode response: %w", err)
	}

	if len(result.Items) == 0 {
		return nil, fmt.Errorf("jellyfin: no item found for TMDB ID %d", tmdbID)
	}

	return &result.Items[0], nil
}

// GetMediaSources obtiene las fuentes de medios de un item en Jellyfin.
func (c *Client) GetMediaSources(ctx context.Context, jellyfinID string) ([]JellyfinMediaSource, error) {
	url := fmt.Sprintf("%s/Items/%s/MediaSources", c.baseURL, jellyfinID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: failed to create request: %w", err)
	}
	req.Header.Set("X-Emby-Token", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jellyfin: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var sources []JellyfinMediaSource
	if err := json.NewDecoder(resp.Body).Decode(&sources); err != nil {
		return nil, fmt.Errorf("jellyfin: failed to decode response: %w", err)
	}

	return sources, nil
}

// GetItem obtiene un item específico por su ID de Jellyfin.
func (c *Client) GetItem(ctx context.Context, jellyfinID string) (*JellyfinItem, error) {
	url := fmt.Sprintf("%s/Items/%s", c.baseURL, jellyfinID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: failed to create request: %w", err)
	}
	req.Header.Set("X-Emby-Token", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jellyfin: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var item JellyfinItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("jellyfin: failed to decode response: %w", err)
	}

	return &item, nil
}

// SearchByName busca items en Jellyfin por nombre.
func (c *Client) SearchByName(ctx context.Context, name string, includeItemTypes string, limit int) ([]JellyfinItem, error) {
	url := fmt.Sprintf("%s/Items?Name=%s&IncludeItemTypes=%s&Limit=%d", c.baseURL, name, includeItemTypes, limit)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: failed to create request: %w", err)
	}
	req.Header.Set("X-Emby-Token", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jellyfin: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jellyfin: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result JellyfinItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("jellyfin: failed to decode response: %w", err)
	}

	return result.Items, nil
}
