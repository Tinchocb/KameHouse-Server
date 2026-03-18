package torrentio

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/goccy/go-json"
	"kamehouse/internal/util/cache"
)

// DefaultAddonURL is the public Torrentio Stremio addon endpoint.
// Override with TORRENTIO_ADDON_URL environment variable.
const DefaultAddonURL = "https://torrentio.strem.fun"

// ─────────────────────────────────────────────────────────────────────────────
// Data structures
// ─────────────────────────────────────────────────────────────────────────────

// TorrentioSource is the normalised representation of a single stream returned
// by the Torrentio/Stremio addon, ready to be mapped to dto.EpisodeSource.
type TorrentioSource struct {
	// Name is the raw "name" field from the Stremio stream response.
	Name string
	// Title is the raw "title" field (multi-line). The first line is the
	// filename; subsequent lines may contain codec / size / seeder info.
	Title string
	// MagnetURI is the magnet link. Empty when the stream is debrid-resolved.
	MagnetURI string
	// URL is set for debrid (HTTP) streams, empty for raw P2P torrents.
	URL string
	// InfoHash identifies the torrent.
	InfoHash string
	// FileIdx is the file index inside the torrent batch.
	FileIdx int
	// Quality is the normalised quality label ("4K", "1080p", "720p", …).
	Quality string
	// ReleaseGroup is the parsed release-group / fansub name.
	ReleaseGroup string
	// Filename is the first line of Title (typically the actual file name).
	Filename string
	// Seeders extracted from the title. -1 when unknown.
	Seeders int
	// IsDebrid is true when the stream comes from a debrid service (HTTP URL).
	IsDebrid bool
}

// stremioStreamResponse is the top-level shape returned by the Stremio addon.
type stremioStreamResponse struct {
	Streams []stremioStream `json:"streams"`
}

type stremioStream struct {
	Name        string          `json:"name"`
	Title       string          `json:"title"`
	URL         string          `json:"url,omitempty"`
	InfoHash    string          `json:"infoHash,omitempty"`
	FileIdx     int             `json:"fileIdx,omitempty"`
	BehaviorHints *behaviorHints `json:"behaviorHints,omitempty"`
}

type behaviorHints struct {
	Filename string `json:"filename,omitempty"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

// Provider fetches streams from the Torrentio (Stremio-compatible) addon.
type Provider struct {
	addonURL string
	client   *http.Client
	cache    *cache.Cache[[]TorrentioSource]
}

// NewProvider creates a Provider. The addon base URL is read from the customUrl parameter,
// falling back to the TORRENTIO_ADDON_URL environment variable, and then the public endpoint.
// All requests are subject to the caller-supplied context timeout.
func NewProvider(customUrl string) *Provider {
	url := DefaultAddonURL
	if customUrl != "" {
		url = strings.TrimRight(customUrl, "/")
	} else if v := os.Getenv("TORRENTIO_ADDON_URL"); v != "" {
		url = strings.TrimRight(v, "/")
	}
	return &Provider{
		addonURL: url,
		client:   &http.Client{},
		cache:    cache.NewCache[[]TorrentioSource](15 * time.Minute),
	}
}

// GetSourcesForEpisode fetches Torrentio streams for a given IMDB ID,
// season, and episode number. The caller is responsible for any timeout via ctx.
//
// Returns an empty slice (not an error) when the addon returns no results.
func (p *Provider) GetSourcesForEpisode(
	ctx context.Context,
	imdbID string,
	season, episode int,
) ([]TorrentioSource, error) {
	if imdbID == "" {
		return nil, fmt.Errorf("torrentio: imdbID is required")
	}

	// Stremio series stream URL: /stream/series/<imdbID>:<season>:<episode>.json
	endpoint := fmt.Sprintf("%s/stream/series/%s:%d:%d.json", p.addonURL, imdbID, season, episode)

	// Intercept via memory cache layer
	if cached, ok := p.cache.Get(endpoint); ok {
		return cached, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("torrentio: build request: %w", err)
	}
	req.Header.Set("User-Agent", "KameHouse/1.0 (Stremio-compatible client)")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("torrentio: HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// No streams — treat as empty, not an error.
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("torrentio: unexpected status %d for %s", resp.StatusCode, endpoint)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("torrentio: read body: %w", err)
	}

	var raw stremioStreamResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("torrentio: parse response: %w", err)
	}

	result := mapStreams(raw.Streams)

	// Persist the resulting streams to cache
	p.cache.Set(endpoint, result)

	return result, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

func mapStreams(streams []stremioStream) []TorrentioSource {
	out := make([]TorrentioSource, 0, len(streams))
	for _, s := range streams {
		src := TorrentioSource{
			Name:         s.Name,
			Title:        s.Title,
			InfoHash:     s.InfoHash,
			FileIdx:      s.FileIdx,
			Quality:      parseQuality(s.Name, s.Title),
			ReleaseGroup: parseReleaseGroup(s.Name),
			Filename:     parseFilename(s.Title),
			Seeders:      parseSeeders(s.Title),
			IsDebrid:     s.URL != "" && !strings.HasPrefix(s.URL, "magnet:"),
		}
		if strings.HasPrefix(s.URL, "magnet:") {
			src.MagnetURI = s.URL
		} else if s.URL != "" {
			src.URL = s.URL
		} else if s.InfoHash != "" {
			// Build a minimal magnet from infoHash when no URL is provided.
			src.MagnetURI = fmt.Sprintf("magnet:?xt=urn:btih:%s", s.InfoHash)
		}
		out = append(out, src)
	}
	return out
}

// qualityPatterns lists quality markers from highest to lowest. The first match wins.
var qualityPatterns = []struct {
	label   string
	markers []string
}{
	{"4K HDR", []string{"4k hdr", "2160p hdr", "uhd hdr"}},
	{"4K", []string{"4k", "2160p", "uhd"}},
	{"1080p", []string{"1080p", "1080i", "fhd"}},
	{"720p", []string{"720p", "hd"}},
	{"480p", []string{"480p", "sd"}},
	{"360p", []string{"360p"}},
}

// parseQuality normalises the Torrentio stream name/title to one of the
// canonical quality labels understood by the frontend SourceSelector.
func parseQuality(name, title string) string {
	haystack := strings.ToLower(name + " " + title)
	for _, p := range qualityPatterns {
		for _, m := range p.markers {
			if strings.Contains(haystack, m) {
				return p.label
			}
		}
	}
	return "unknown"
}

// parseReleaseGroup extracts the fansub/release-group name from the stream
// "name" field. Torrentio typically formats it as "Torrentio\n<group>" or
// just "<group>" depending on addon configuration.
func parseReleaseGroup(name string) string {
	lines := strings.Split(strings.TrimSpace(name), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.EqualFold(line, "torrentio") {
			continue
		}
		return line
	}
	return ""
}

// parseFilename returns the first non-empty line of the title field.
// Torrentio uses the first line as the actual filename.
func parseFilename(title string) string {
	lines := strings.SplitN(strings.TrimSpace(title), "\n", 2)
	if len(lines) > 0 {
		return strings.TrimSpace(lines[0])
	}
	return ""
}

// seederRe matches patterns like "👤 123" or "Seeders: 123" in Torrentio titles.
// The 👤 emoji is included literally (U+1F464, encoded as \xF0\x9F\x91\xA4 in UTF-8).
// We avoid (?i) on the emoji group to prevent RE2 case-folding issues.
var seederRe = regexp.MustCompile("(?:👤|[Ss]eeders?:?)\\s*(\\d+)")

// parseSeeders tries to extract a seeder count from the Torrentio title.
// Returns -1 when no seeder information is present.
func parseSeeders(title string) int {
	m := seederRe.FindStringSubmatch(title)
	if len(m) < 2 {
		return -1
	}
	n, err := strconv.Atoi(m[1])
	if err != nil {
		return -1
	}
	return n
}
