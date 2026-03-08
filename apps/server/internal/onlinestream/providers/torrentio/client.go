package torrentio

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

const (
	// defaultBaseURL is the public Torrentio endpoint pre-configured with
	// anime-focused sources and Latino/Japanese/Spanish audio tracks.
	//
	// IMPORTANT: The config segment (providers=...|language=...|...) uses raw pipe
	// and comma characters that Torrentio strict-matches. Do NOT pass this URL
	// through url.JoinPath or url.PathEscape — they will percent-encode | and ,
	// causing 404s from the upstream. Always use raw string concatenation.
	defaultBaseURL = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,nekobt|language=latino,japanese,spanish|qualityfilter=hdrall,dolbyvision,dolbyvisionwithhdr,4k,1080p,720p,unknown|limit=2"

	// streamHTTPTimeout is the maximum round-trip for a single stream fetch.
	// Shorter than the old 15 s — Torrentio usually responds in <3 s.
	streamHTTPTimeout = 10 * time.Second

	// rateLimitRPS — sustained request rate (requests per second).
	rateLimitRPS = 1.0
	// rateLimitBurst — maximum burst allowed above the sustained rate.
	rateLimitBurst = 3
)

// cleanBaseURL strips a trailing "/manifest.json" (or "/manifest.json?…") from
// rawURL and returns the bare configuration base path that Torrentio uses as
// the prefix for all other endpoints.
//
// Examples:
//
//	"https://torrentio.strem.fun/lang=es|limit=2/manifest.json"
//	  → "https://torrentio.strem.fun/lang=es|limit=2"
//
//	"https://torrentio.strem.fun/lang=es|limit=2"
//	  → "https://torrentio.strem.fun/lang=es|limit=2"  (unchanged)
func cleanBaseURL(rawURL string) string {
	// Strip query string before suffix check so "manifest.json?foo" is handled.
	base, _, _ := strings.Cut(rawURL, "?")
	return strings.TrimSuffix(base, "/manifest.json")
}

// streamURL builds the raw stream endpoint for a given media type and Stremio ID.
//
// The config segment of baseURL is kept verbatim (no encoding) so that pipe and
// comma characters reach Torrentio unmodified.
//
//	Format: {baseURL}/stream/{mediaType}/{stremioID}.json
//	Example: https://torrentio.strem.fun/lang=es|limit=2/stream/anime/123:1.json
func streamURL(baseURL, mediaType, stremioID string) string {
	// Pre-allocate a builder sized to avoid repeated growth.
	var b strings.Builder
	b.Grow(len(baseURL) + 10 + len(mediaType) + len(stremioID))
	b.WriteString(baseURL)
	b.WriteString("/stream/")
	b.WriteString(mediaType)
	b.WriteByte('/')
	b.WriteString(stremioID)
	b.WriteString(".json")
	return b.String()
}

// Client wraps net/http with a timeout and a token-bucket rate limiter.
// It is safe for concurrent use.
type Client struct {
	httpClient  *http.Client
	rateLimiter *rate.Limiter
	baseURL     string // clean base — no trailing /manifest.json
	logger      *zerolog.Logger
}

// newClient returns a Client using the built-in default Torrentio configuration.
func newClient(logger *zerolog.Logger) *Client {
	return newClientWithURL(defaultBaseURL, logger)
}

// newClientWithURL returns a Client whose base URL is derived from rawURL.
// If rawURL ends with "/manifest.json" it is stripped automatically, so the
// caller may pass either a manifest URL or the bare configuration URL.
func newClientWithURL(rawURL string, logger *zerolog.Logger) *Client {
	return &Client{
		httpClient:  &http.Client{Timeout: streamHTTPTimeout},
		rateLimiter: rate.NewLimiter(rate.Limit(rateLimitRPS), rateLimitBurst),
		baseURL:     cleanBaseURL(rawURL),
		logger:      logger,
	}
}

// fetchStreams performs a GET request to the Torrentio stream endpoint for the
// given Kitsu anime ID and episode number.
//
// URL shape: {baseURL}/stream/anime/{kitsuID}:{episode}.json
//
// The context controls both rate-limiter waiting and the HTTP round-trip,
// so callers can cancel in-flight requests at any time.
func (c *Client) fetchStreams(ctx context.Context, kitsuID int, episode int) (*torrentioResponse, error) {
	// ── Rate limiting ──────────────────────────────────────────────────────────
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("torrentio: rate limiter cancelled: %w", err)
	}

	// ── Build URL ──────────────────────────────────────────────────────────────
	// stremioID uses the Kitsu ID + episode number in Stremio's "kitsuID:episode"
	// notation. Raw string concat preserves | and , in the config segment.
	stremioID := fmt.Sprintf("%d:%d", kitsuID, episode)
	url := streamURL(c.baseURL, "anime", stremioID)

	c.logger.Debug().Str("url", url).Msg("torrentio: fetching streams")

	// ── HTTP request ───────────────────────────────────────────────────────────
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("torrentio: building request: %w", err)
	}
	req.Header.Set("User-Agent", "Antigravity/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("torrentio: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// ── Status check ───────────────────────────────────────────────────────────
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return nil, fmt.Errorf("torrentio: rate-limited by upstream (HTTP 429)")
	case http.StatusOK:
		// expected — fall through
	default:
		return nil, fmt.Errorf("torrentio: unexpected status %d for %s", resp.StatusCode, url)
	}

	// ── Read and decode body ───────────────────────────────────────────────────
	// Limit body read to 2 MB to guard against runaway responses.
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("torrentio: reading response body: %w", err)
	}

	var result torrentioResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("torrentio: decoding JSON response: %w", err)
	}

	c.logger.Debug().
		Int("streamCount", len(result.Streams)).
		Msg("torrentio: streams received")

	return &result, nil
}

// fetchStreamsForID is the generic variant of fetchStreams for any Stremio media
// type and pre-formatted ID string (e.g. "tt1234567" for IMDB, "123:1" for Kitsu).
// This allows future reuse for movie / series endpoints without duplicating the
// HTTP scaffolding.
func (c *Client) fetchStreamsForID(ctx context.Context, mediaType, stremioID string) (*torrentioResponse, error) {
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("torrentio: rate limiter cancelled: %w", err)
	}

	url := streamURL(c.baseURL, mediaType, stremioID)
	c.logger.Debug().Str("url", url).Msg("torrentio: fetching streams (generic)")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("torrentio: building request: %w", err)
	}
	req.Header.Set("User-Agent", "Antigravity/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("torrentio: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return nil, fmt.Errorf("torrentio: rate-limited by upstream (HTTP 429)")
	case http.StatusOK:
	default:
		return nil, fmt.Errorf("torrentio: unexpected status %d for %s", resp.StatusCode, url)
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("torrentio: reading response body: %w", err)
	}

	var result torrentioResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("torrentio: decoding JSON response: %w", err)
	}

	c.logger.Debug().Int("streamCount", len(result.Streams)).Msg("torrentio: streams received")
	return &result, nil
}
