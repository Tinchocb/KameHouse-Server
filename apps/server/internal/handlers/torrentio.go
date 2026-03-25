package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kamehouse/internal/api/animap"
	"kamehouse/internal/api/torrentio"

	"github.com/labstack/echo/v4"
)

// TorrentioStreamResult is the JSON contract returned by the /torrentio/streams
// endpoint, matching the TorrentioStreamResult interface in the frontend hook.
type TorrentioStreamResult struct {
	Name         string `json:"name"`
	Title        string `json:"title"`
	InfoHash     string `json:"infoHash"`
	FileIdx      int    `json:"fileIdx"`
	Quality      string `json:"quality"`
	ReleaseGroup string `json:"releaseGroup"`
	Filename     string `json:"filename"`
	Seeders      int    `json:"seeders,omitempty"`
	MagnetURI    string `json:"magnetUri,omitempty"`
}

// HandleGetTorrentioStreams responds to:
//
//	GET /api/v1/torrentio/streams?kitsuId=<int>&episode=<int>&season=<int>
//
// Flow: kitsuId → AniZip mapping → IMDB ID → Torrentio addon → TorrentioStreamResult[].
//
// The endpoint is intentionally non-fatal: all recoverable errors return 200 []
// so the frontend can gracefully show "no Torrentio sources available" rather
// than an error state.
func (h *Handler) HandleGetTorrentioStreams(c echo.Context) error {
	// ── Parse query parameters ──────────────────────────────────────────────
	kitsuIdStr := c.QueryParam("kitsuId")
	episodeStr := c.QueryParam("episode")
	seasonStr := c.QueryParam("season")

	if kitsuIdStr == "" || episodeStr == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "kitsuId and episode query parameters are required",
		})
	}

	kitsuId, err := strconv.Atoi(kitsuIdStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "kitsuId must be a valid integer",
		})
	}

	episode, err := strconv.Atoi(episodeStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "episode must be a valid integer",
		})
	}

	season := 1
	if seasonStr != "" {
		if s, err := strconv.Atoi(seasonStr); err == nil && s > 0 {
			season = s
		}
	}

	// ── Map kitsuId → IMDB identifier via Animap ─────────────────────────────────────
	// Local DB persistent cache bypasses network redundancy completely
	mapping, animapErr := animap.FetchAnimapMediaPersistent(h.App.Database, "kitsu", kitsuId)
	if animapErr != nil || mapping == nil || mapping.Mappings == nil {
		h.App.Logger.Warn().
			Err(animapErr).
			Int("kitsuId", kitsuId).
			Msg("torrentio handler: animap lookup failed — returning empty streams")
		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	// ── Resolve the correct identifier for Torrentio ──────────────────────
	// Torrentio/Stremio only understands IMDB IDs (tt1234567) or kitsu:<id>.
	// TMDB IDs are NOT supported by the Stremio addon protocol.
	identifier := ""

	// Priority 1: IMDB from the titles map (most reliable for Torrentio)
	if imdb, ok := mapping.Titles["imdb"]; ok && imdb != "" {
		// Ensure it starts with "tt" (standard IMDB format)
		if !strings.HasPrefix(imdb, "tt") {
			identifier = "tt" + imdb
		} else {
			identifier = imdb
		}
	}

	// Priority 2: Fallback to kitsu ID (Torrentio supports kitsu:<id>)
	if identifier == "" {
		identifier = "kitsu:" + strconv.Itoa(kitsuId)
	}

	// ── Get or create the Torrentio provider (singleton) ─────────────────
	provider := h.getOrCreateTorrentioProvider()

	// ── Fetch streams ────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	streams, fetchErr := provider.GetSourcesForEpisode(ctx, identifier, season, episode)
	if fetchErr != nil {
		h.App.Logger.Warn().
			Err(fetchErr).
			Str("identifier", identifier).
			Int("season", season).
			Int("episode", episode).
			Msg("torrentio handler: provider fetch failed — returning graceful empty UI state")

		// Dispatch background pre-cache attempt if connection recovers
		go func() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer bgCancel()
			_, _ = provider.GetSourcesForEpisode(bgCtx, identifier, season, episode)
		}()

		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	if len(streams) == 0 {
		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	// ── Map to frontend contract ─────────────────────────────────────────────
	results := make([]TorrentioStreamResult, 0, len(streams))
	for _, s := range streams {
		results = append(results, TorrentioStreamResult{
			Name:         s.Name,
			Title:        s.Title,
			InfoHash:     s.InfoHash,
			FileIdx:      s.FileIdx,
			Quality:      s.Quality,
			ReleaseGroup: s.ReleaseGroup,
			Filename:     s.Filename,
			Seeders:      s.Seeders,
			MagnetURI:    s.MagnetURI,
		})
	}

	h.App.Logger.Info().
		Str("identifier", identifier).
		Int("kitsuId", kitsuId).
		Int("season", season).
		Int("episode", episode).
		Int("count", len(results)).
		Msg("torrentio handler: returning streams")

	return c.JSON(http.StatusOK, results)
}

// getOrCreateTorrentioProvider returns the singleton Torrentio provider,
// creating it on first use. This ensures the in-memory cache survives
// across requests.
func (h *Handler) getOrCreateTorrentioProvider() *torrentio.Provider {
	if h.App.TorrentioProvider != nil {
		return h.App.TorrentioProvider
	}

	// User specifically requested this language/quality filter config
	torrentioUrl := "https://torrentio.strem.fun/language=latino|qualityfilter=scr,brremux,hdrall,dolbyvision,dolbyvisionwithhdr,4k,1080p,720p"

	h.App.TorrentioProvider = torrentio.NewProvider(torrentioUrl)
	return h.App.TorrentioProvider
}
