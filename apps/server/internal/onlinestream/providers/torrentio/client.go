package torrentio

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

const (
	// torrentioBaseURL is the public Torrentio endpoint, pre-configured with:
	//   • providers  — anime-focused sources (nyaasi, tokyotosho, anidex, etc.)
	//   • language   — Latino, Japanese, Spanish audio/subtitle tracks only
	//   • qualityfilter — excludes HDR, Dolby Vision, 4K, 1080p, 720p and unknown
	//     Note: "qualityfilter" is Torrentio's exclusion list, so the listed
	//     qualities are REMOVED from results; only standard/480p-and-below remain.
	//   • limit      — cap at 2 results per episode (reduces scraper load)
	//
	// IMPORTANT: Do not modify this URL at runtime. If different filter profiles
	// are needed, create a new Provider instance with a different baseURL.
	torrentioBaseURL = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,nekobt|language=latino,japanese,spanish|qualityfilter=hdrall,dolbyvision,dolbyvisionwithhdr,4k,1080p,720p,unknown|limit=2"

	// httpTimeout is the maximum round-trip duration for a single request.
	httpTimeout = 15 * time.Second

	// rateLimitRPS — sustained request rate (requests per second).
	rateLimitRPS = 1.0
	// rateLimitBurst — maximum burst allowed above the sustained rate.
	rateLimitBurst = 3
)

// Client wraps net/http with a timeout and a token-bucket rate limiter.
// It is safe for concurrent use.
type Client struct {
	httpClient  *http.Client
	rateLimiter *rate.Limiter
	baseURL     string
	logger      *zerolog.Logger
}

// newClient returns a ready-to-use Client.
func newClient(logger *zerolog.Logger) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: httpTimeout,
		},
		rateLimiter: rate.NewLimiter(rate.Limit(rateLimitRPS), rateLimitBurst),
		baseURL:     torrentioBaseURL,
		logger:      logger,
	}
}

// fetchStreams performs a GET request to the Torrentio stream endpoint for the
// given Kitsu anime ID and episode number.
//
// Torrentio URL format:
//
//	https://torrentio.strem.fun/stream/anime/{kitsuID}:{episode}.json
//
// The context is used for both rate-limiter waiting and the HTTP request,
// so callers can cancel in-flight requests.
func (c *Client) fetchStreams(ctx context.Context, kitsuID int, episode int) (*torrentioResponse, error) {
	// ── Rate limiting ─────────────────────────────────────────────────────────
	// Wait until a token is available; respects ctx cancellation.
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("torrentio: rate limiter cancelled: %w", err)
	}

	// ── Build URL ─────────────────────────────────────────────────────────────
	url := fmt.Sprintf("%s/stream/anime/%d:%d.json", c.baseURL, kitsuID, episode)

	c.logger.Debug().
		Str("url", url).
		Msg("torrentio: fetching streams")

	// ── HTTP request ──────────────────────────────────────────────────────────
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("torrentio: building request: %w", err)
	}

	// Identify ourselves politely to the upstream.
	req.Header.Set("User-Agent", "KameHouse/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("torrentio: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// ── Status check ──────────────────────────────────────────────────────────
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("torrentio: rate-limited by upstream (HTTP 429)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("torrentio: unexpected status %d for %s", resp.StatusCode, url)
	}

	// ── Read and decode body ──────────────────────────────────────────────────
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
