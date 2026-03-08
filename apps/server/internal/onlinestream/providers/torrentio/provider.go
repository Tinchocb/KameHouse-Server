package torrentio

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/rs/zerolog"
)

// ─────────────────────────────────────────────────────────────────────────────
// Well-known public torrent trackers appended to generated magnet URIs.
// ─────────────────────────────────────────────────────────────────────────────
var defaultTrackers = []string{
	"udp://open.demonii.com:1337/announce",
	"udp://tracker.openbittorrent.com:6969/announce",
	"udp://tracker.torrent.eu.org:451/announce",
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://explodie.org:6969/announce",
	"udp://tracker.zerobytes.xyz:1337/announce",
	"udp://1337.abcvg.info:80/announce",
	"udp://tracker.internetwarriors.net:1337/announce",
	"udp://open.stealth.si:80/announce",
	"udp://ipv4.tracker.harry.lu:80/announce",
	"udp://tracker.tiny-vps.com:6969/announce",
	"udp://open.demonii.com:1337/announce",
}

// qualityOrder defines the sort priority for quality labels (lower = higher priority).
var qualityOrder = map[string]int{
	"4k":      0,
	"2160p":   0,
	"1080p":   1,
	"720p":    2,
	"480p":    3,
	"360p":    4,
	"unknown": 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

// Provider is the public facade for the Torrentio integration.
// It is stateless and safe to create per-request, or to share across goroutines.
type Provider struct {
	client *Client
	logger *zerolog.Logger
}

// NewProvider creates a Torrentio Provider with a pre-configured HTTP client.
func NewProvider(logger *zerolog.Logger) *Provider {
	return &Provider{
		client: newClient(logger),
		logger: logger,
	}
}

// GetStreams fetches and normalises torrent streams from Torrentio for the
// given Kitsu anime ID and episode number.
//
// Parameters:
//   - kitsuID  — the Kitsu anime identifier (e.g. 13601 for Bleach)
//   - episode  — the episode number within the series (1-based)
//
// Returns a slice of [StreamResult] sorted by quality (4K → 1080p → 720p → …),
// or an empty slice when Torrentio returns no results for that episode.
func (p *Provider) GetStreams(ctx context.Context, kitsuID int, episode int) ([]*StreamResult, error) {
	raw, err := p.client.fetchStreams(ctx, kitsuID, episode)
	if err != nil {
		return nil, fmt.Errorf("torrentio: GetStreams: %w", err)
	}

	results := make([]*StreamResult, 0, len(raw.Streams))
	for _, s := range raw.Streams {
		results = append(results, mapStream(s))
	}

	// Sort by quality: best quality first, then alphabetically by release group.
	sort.Slice(results, func(i, j int) bool {
		qi := qualityPriority(results[i].Quality)
		qj := qualityPriority(results[j].Quality)
		if qi != qj {
			return qi < qj
		}
		return results[i].ReleaseGroup < results[j].ReleaseGroup
	})

	p.logger.Info().
		Int("kitsuID", kitsuID).
		Int("episode", episode).
		Int("results", len(results)).
		Msg("torrentio: GetStreams completed")

	return results, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

// mapStream converts a raw torrentioStream into a canonical StreamResult.
func mapStream(s torrentioStream) *StreamResult {
	quality := parseQuality(s.Name)
	releaseGroup := parseReleaseGroup(s.Title)

	return &StreamResult{
		Name:         s.Name,
		Title:        s.Title,
		InfoHash:     s.InfoHash,
		FileIdx:      s.FileIdx,
		Quality:      quality,
		ReleaseGroup: releaseGroup,
		Filename:     s.BehaviorHints.Filename,
		MagnetURI:    buildMagnetURI(s.InfoHash, releaseGroup),
	}
}

// parseQuality extracts the quality label from the Torrentio "name" field.
//
// Torrentio formats the name field as:
//
//	"Torrentio\n1080p"
//	"Torrentio\n4K"
//
// We search each line for known quality tokens (case-insensitive).
func parseQuality(name string) string {
	lower := strings.ToLower(name)
	for _, q := range []string{"4k", "2160p", "1080p", "720p", "480p", "360p"} {
		if strings.Contains(lower, q) {
			// Normalise "4k" → "4K" for display purposes.
			if q == "4k" {
				return "4K"
			}
			return q
		}
	}
	return "unknown"
}

// parseReleaseGroup extracts the release-group name from the Torrentio "title"
// field.  Torrentio formats the first line of Title as either:
//
//	"SubsPlease - Bleach TYBW - 25 (1080p) [HASH]"   → "SubsPlease"
//	"[SubsPlease] Bleach TYBW 25"                     → "SubsPlease"
//	"Erai-raws | Bleach TYBW | 25 [1080p]"            → "Erai-raws"
//
// We take only the first line and look for the first word-like token before a
// separator (" - ", " | ", "]" or end-of-token).
func parseReleaseGroup(title string) string {
	// Use only the first line of the title.
	firstLine := strings.SplitN(title, "\n", 2)[0]
	firstLine = strings.TrimSpace(firstLine)

	// Strip leading "[" (bracket-prefixed groups like "[SubsPlease]").
	firstLine = strings.TrimPrefix(firstLine, "[")

	// Split on common separators and take the first segment.
	for _, sep := range []string{"] ", " - ", " | ", "|"} {
		if idx := strings.Index(firstLine, sep); idx > 0 {
			return strings.TrimSpace(firstLine[:idx])
		}
	}

	// Fallback: first token (space-separated).
	parts := strings.Fields(firstLine)
	if len(parts) > 0 {
		return parts[0]
	}
	return "unknown"
}

// buildMagnetURI constructs a magnet URI from an InfoHash with the project's
// default tracker list.  The display name is set to the release group.
func buildMagnetURI(infoHash string, displayName string) string {
	if infoHash == "" {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("magnet:?xt=urn:btih:")
	sb.WriteString(infoHash)

	if displayName != "" && displayName != "unknown" {
		sb.WriteString("&dn=")
		sb.WriteString(strings.ReplaceAll(displayName, " ", "+"))
	}

	for _, tracker := range defaultTrackers {
		sb.WriteString("&tr=")
		sb.WriteString(tracker)
	}

	return sb.String()
}

// qualityPriority returns the sort order integer for a quality string.
// Lower integers sort first (higher quality).
func qualityPriority(q string) int {
	if p, ok := qualityOrder[strings.ToLower(q)]; ok {
		return p
	}
	return qualityOrder["unknown"]
}
