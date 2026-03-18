package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"kamehouse/internal/api/anizip"
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

// torrentioAniZipCache is a request-scoped cache shared across handler calls.
// A package-level instance avoids duplicated AniZip HTTP calls between
// /torrentio/streams and the SourcePriorityEngine.
var torrentioAniZipCache = anizip.NewCache()

// HandleGetTorrentioStreams responds to:
//
//	GET /api/v1/torrentio/streams?kitsuId=<int>&episode=<int>
//
// Flow: kitsuId → AniZip mapping → imdbID → Torrentio addon → TorrentioStreamResult[].
//
// The endpoint is intentionally non-fatal: all recoverable errors return 200 []
// so the frontend can gracefully show "no Torrentio sources available" rather
// than an error state.
func (h *Handler) HandleGetTorrentioStreams(c echo.Context) error {
	// ── Parse query parameters ──────────────────────────────────────────────
	kitsuIdStr := c.QueryParam("kitsuId")
	episodeStr := c.QueryParam("episode")

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

	// ── Map kitsuId → imdbID via AniZip ─────────────────────────────────────
	ctx, cancel := context.WithTimeout(c.Request().Context(), 8*time.Second)
	defer cancel()

	mapping, anizipErr := anizip.FetchAniZipMediaC("kitsu", kitsuId, torrentioAniZipCache)
	if anizipErr != nil || mapping == nil || mapping.Mappings == nil {
		h.App.Logger.Warn().
			Err(anizipErr).
			Int("kitsuId", kitsuId).
			Msg("torrentio handler: anizip lookup failed — returning empty streams")
		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	imdbID := mapping.Mappings.ImdbID
	if imdbID == "" {
		h.App.Logger.Warn().
			Int("kitsuId", kitsuId).
			Msg("torrentio handler: no IMDB ID in anizip mapping — returning empty streams")
		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	// ── Fetch from Torrentio addon ───────────────────────────────────────────
	debridSettings, _ := h.App.Database.GetDebridSettings()
	torrentioUrl := ""
	if debridSettings != nil {
		torrentioUrl = debridSettings.TorrentioUrl
	}

	provider := torrentio.NewProvider(torrentioUrl)
	streams, fetchErr := provider.GetSourcesForEpisode(ctx, imdbID, 1, episode)
	if fetchErr != nil {
		h.App.Logger.Warn().
			Err(fetchErr).
			Str("imdbID", imdbID).
			Int("episode", episode).
			Msg("torrentio handler: provider fetch failed — returning empty streams")
		// Return 200 with empty array so the frontend shows "no results", not an error.
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
		Str("imdbID", imdbID).
		Int("kitsuId", kitsuId).
		Int("episode", episode).
		Int("count", len(results)).
		Msg("torrentio handler: returning streams")

	return c.JSON(http.StatusOK, results)
}
