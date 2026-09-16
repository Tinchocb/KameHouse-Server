package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"kamehouse/internal/core"

	"github.com/labstack/echo/v4"
)

// HandleResolveStreams resolves all available playback sources for a given
// episode using the UnifiedResolver.
//
// @summary  Resolve all playback sources for an episode
// @desc     Returns a list of ResolvedSource objects. Only local files
//	are supported in this architecture.
//
// @returns  []core.ResolvedSource
// @route    /api/v1/resolver/streams [GET]
//
// Query parameters:
//   - mediaID  (required) — Platform media ID (positive) or TMDB ID (negative)
//   - episode  (required) — 1-based episode number
//   - kitsuId  (optional) — Kitsu anime ID; if absent, Torrentio is skipped
func (h *Handler) HandleResolveStreams(c echo.Context) error {
	// ── Parse required params ─────────────────────────────────────────────────

	mediaIDStr := c.QueryParam("mediaID")
	if mediaIDStr == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("query parameter 'mediaID' is required"))
	}
	if _, err := strconv.Atoi(mediaIDStr); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("'mediaID' must be a valid integer"))
	}

	episodeStr := c.QueryParam("episode")
	if episodeStr == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("query parameter 'episode' is required"))
	}
	episode, err := strconv.Atoi(episodeStr)
	if err != nil || episode <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("'episode' must be a positive integer"))
	}

	// ── Parse optional param ──────────────────────────────────────────────────

	mediaType := c.QueryParam("mediaType")
	if mediaType == "" {
		mediaType = "anime" // default
	}
	if mediaType != "anime" && mediaType != "movie" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid 'mediaType', expected 'anime' or 'movie'"))
	}

	// ── Resolve ───────────────────────────────────────────────────────────────

	resolver := core.NewUnifiedResolver(h.App.Database, h.App.Logger)

	unifiedResponse, err := resolver.ResolveUnifiedMedia(c.Request().Context(), mediaIDStr, episode, mediaType)
	if err != nil {
		h.App.Logger.Error().Err(err).
			Str("mediaID", mediaIDStr).
			Int("episode", episode).
			Msg("resolver: handler error")
		return h.RespondWithError(c, err)
	}

	if unifiedResponse != nil && h.App.Config != nil && h.App.Config.Server.Password != "" {
		if token, tokenErr := h.App.GetServerPasswordHMACAuth().GenerateToken("*"); tokenErr == nil {
			for i := range unifiedResponse.Sources {
				if strings.HasPrefix(unifiedResponse.Sources[i].URLPath, "/") {
					sep := "?"
					if strings.Contains(unifiedResponse.Sources[i].URLPath, "?") {
						sep = "&"
					}
					unifiedResponse.Sources[i].URLPath += sep + "token=" + token
				}
			}
		}
	}

	return h.RespondWithData(c, unifiedResponse)
}
