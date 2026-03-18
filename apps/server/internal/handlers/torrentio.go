package handlers

import (
	"context"
	"net/http"
	"strconv"
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

// (Removed anizip cache)

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

	// ── Map kitsuId → Provider Identifier via Animap ─────────────────────────────────────
	// Local DB persistent cache bypasses network redundancy completely
	mapping, animapErr := animap.FetchAnimapMediaPersistent(h.App.Database, "kitsu", kitsuId)
	if animapErr != nil || mapping == nil || mapping.Mappings == nil {
		h.App.Logger.Warn().
			Err(animapErr).
			Int("kitsuId", kitsuId).
			Msg("torrentio handler: animap lookup failed — returning empty streams")
		return c.JSON(http.StatusOK, []TorrentioStreamResult{})
	}

	identifier := ""
	if mapping.Mappings.TheMovieDbID != "" {
		identifier = "tmdb:" + mapping.Mappings.TheMovieDbID
	} else if imdb, ok := mapping.Titles["imdb"]; ok && imdb != "" {
		identifier = imdb
	} else {
		// Fallback to Kitsu itself if TMDB/IMDB fails mapping
		identifier = "kitsu:" + strconv.Itoa(kitsuId)
	}

	// ── Fetch from Torrentio addon ───────────────────────────────────────────
	debridSettings, _ := h.App.Database.GetDebridSettings()
	torrentioUrl := ""
	if debridSettings != nil {
		torrentioUrl = debridSettings.TorrentioUrl
	}

	provider := torrentio.NewProvider(torrentioUrl)

	// Since we introduced a memory cache layer inside `provider.go`, we can attempt a
	// pseudo-fetch check synchronously with a tiny timeout, or check if it's there.
	// But actually `GetSourcesForEpisode` handles everything. Fast returning cache is inside it.
	
	// ── Background Resolution ─────────────────
	// Si el usuario entra y sale rápido, absorbemos todo mediante caché y despachamos en paralelo
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	streams, fetchErr := provider.GetSourcesForEpisode(ctx, identifier, 1, episode)
	if fetchErr != nil {
		// The error could be an ErrRateLimit (HTTP 429) OR Timeout
		h.App.Logger.Warn().
			Err(fetchErr).
			Str("identifier", identifier).
			Int("episode", episode).
			Msg("torrentio handler: provider fetch failed — returning graceful empty UI state")
			
		// Despachar en background para pre-cachear si se recupera la conexión
		go func() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer bgCancel()
			_, _ = provider.GetSourcesForEpisode(bgCtx, identifier, 1, episode)
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
		Int("episode", episode).
		Int("count", len(results)).
		Msg("torrentio handler: returning streams")

	return c.JSON(http.StatusOK, results)
}
