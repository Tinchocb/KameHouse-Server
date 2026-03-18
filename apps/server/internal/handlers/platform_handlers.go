package handlers

import (
	"kamehouse/internal/platforms/platform"
	"net/http"

	"github.com/labstack/echo/v4"
)

// HandlePlatformListAnime bridges legacy Platform list-anime calls to the active platform
func (h *Handler) HandlePlatformListAnime(c echo.Context) error {
	type body struct {
		Page                *int                  `json:"page"`
		Search              *string               `json:"search"`
		PerPage             *int                  `json:"perPage"`
		Sort                []platform.MediaSort  `json:"sort"`
		Status              []platform.MediaStatus `json:"status"`
		Genres              []string              `json:"genres"`
		AverageScoreGreater *int                  `json:"averageScoreGreater"`
		Season              *platform.MediaSeason `json:"season"`
		SeasonYear          *int                  `json:"seasonYear"`
		Format              *platform.MediaFormat `json:"format"`
		IsAdult             *bool                 `json:"isAdult"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	ctx := c.Request().Context()
	activePlatform := h.App.Metadata.PlatformRef.Get()

	res, err := activePlatform.ListAnime(ctx, b.Page, b.Search, b.PerPage, b.Sort, b.Status, b.Genres, b.AverageScoreGreater, b.Season, b.SeasonYear, b.Format, b.IsAdult)
	if err != nil {
		return h.JSON(c, http.StatusInternalServerError, NewErrorResponse(err))
	}

	return h.JSON(c, http.StatusOK, NewDataResponse(res))
}

// HandlePlatformListRecentAiringAnime bridges legacy Platform list-recent-anime calls to the active platform
func (h *Handler) HandlePlatformListRecentAiringAnime(c echo.Context) error {
	type body struct {
		Page            *int  `json:"page"`
		PerPage         *int  `json:"perPage"`
		AiringAtGreater *int  `json:"airingAtGreater"`
		AiringAtLesser  *int  `json:"airingAtLesser"`
		NotYetAired     *bool `json:"notYetAired"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	ctx := c.Request().Context()
	activePlatform := h.App.Metadata.PlatformRef.Get()

	res, err := activePlatform.ListRecentAnime(ctx, b.Page, b.PerPage, b.AiringAtGreater, b.AiringAtLesser, b.NotYetAired)
	if err != nil {
		return h.JSON(c, http.StatusInternalServerError, NewErrorResponse(err))
	}

	return h.JSON(c, http.StatusOK, NewDataResponse(res))
}

// HandleGetPlatformStats returns viewer stats for the active platform
func (h *Handler) HandleGetPlatformStats(c echo.Context) error {
	ctx := c.Request().Context()
	activePlatform := h.App.Metadata.PlatformRef.Get()

	res, err := activePlatform.GetViewerStats(ctx)
	if err != nil {
		return h.JSON(c, http.StatusInternalServerError, NewErrorResponse(err))
	}

	return h.JSON(c, http.StatusOK, NewDataResponse(res))
}
