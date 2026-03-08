package handlers

import (
	"net/http"
	"strconv"

	torrentio "kamehouse/internal/onlinestream/providers/torrentio"

	"github.com/labstack/echo/v4"
)

// HandleGetTorrentioStreams fetches available torrent streams from the Torrentio
// addon API for a given Kitsu anime ID and episode number.
//
//	@summary     Get Torrentio streams for an anime episode
//	@desc        Queries torrentio.strem.fun and returns a list of available
//	             torrent streams sorted by quality (best first).
//	             Each entry includes the infoHash, file index, quality label,
//	             release group, and a ready-to-use magnet URI.
//	@returns     []torrentio.StreamResult
//	@route       /api/v1/torrentio/streams [GET]
//
// Query parameters:
//   - kitsuId  (required) — Kitsu anime identifier (integer)
//   - episode  (required) — Episode number, 1-based (integer)
func (h *Handler) HandleGetTorrentioStreams(c echo.Context) error {
	// ── Parse query parameters ────────────────────────────────────────────────

	kitsuIDStr := c.QueryParam("kitsuId")
	if kitsuIDStr == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "query parameter 'kitsuId' is required",
		})
	}

	episodeStr := c.QueryParam("episode")
	if episodeStr == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "query parameter 'episode' is required",
		})
	}

	kitsuID, err := strconv.Atoi(kitsuIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "'kitsuId' must be a valid integer",
		})
	}

	episode, err := strconv.Atoi(episodeStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "'episode' must be a valid integer",
		})
	}

	if kitsuID <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "'kitsuId' must be a positive integer",
		})
	}
	if episode <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "'episode' must be a positive integer",
		})
	}

	// ── Delegate to the provider ──────────────────────────────────────────────

	provider := torrentio.NewProvider(h.App.Logger)

	streams, err := provider.GetStreams(c.Request().Context(), kitsuID, episode)
	if err != nil {
		h.App.Logger.Error().
			Err(err).
			Int("kitsuId", kitsuID).
			Int("episode", episode).
			Msg("torrentio: handler error")

		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, streams)
}
