package handlers

import (
	"errors"
	"kamehouse/internal/api/anilist"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

// HandleAniListEpisodeThumbnail returns the streaming thumbnail for an anime episode by absolute number.
//
// This is the fallback-3 source for chronology episode thumbnails (local -> TMDB -> AniList -> saga).
// AniList needs no API key and covers full runs (e.g. DBZ 291 streaming episodes), which makes it
// the safety net when TMDB is unconfigured or a still_path is missing.
//
//	@summary get AniList episode streaming thumbnail by absolute episode number
//	@desc Returns thumbnail/title/url for one episode from AniList streamingEpisodes.
//	@route /api/v1/anilist/episode/:anilistId/:absolute [GET]
func (h *Handler) HandleAniListEpisodeThumbnail(c echo.Context) error {
	anilistID, err := strconv.Atoi(c.Param("anilistId"))
	if err != nil || anilistID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anilistId is required"))
	}
	absolute, err := strconv.Atoi(c.Param("absolute"))
	if err != nil || absolute <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive absolute episode is required"))
	}

	client := anilist.NewClient(h.App.Logger)
	ep, err := client.GetEpisodeThumbnail(c.Request().Context(), anilistID, absolute)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"anilistId":       anilistID,
		"absoluteEpisode": absolute,
		"title":           ep.Title,
		"thumbnailUrl":    ep.Thumbnail,
		"url":             ep.URL,
		"site":            ep.Site,
	})
}
