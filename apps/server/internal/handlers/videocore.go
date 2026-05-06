package handlers

import (
	"strconv"

	"kamehouse/internal/videocore"

	"github.com/labstack/echo/v4"
)

// HandleGetVideoInsights
//
//	@summary returns video insights (heatmap)
//	@param episodeId - string - true - "The Episode ID or string seed"
//	@param duration - float - false - "The total duration of the video in seconds"
//	@returns []videocore.InsightNode
//	@route /api/v1/videocore/insights/{episodeId} [GET]
func (h *Handler) HandleGetVideoInsights(c echo.Context) error {
	episodeId := c.Param("episodeId")
	durationStr := c.QueryParam("duration")

	duration := 1440.0 // 24 minutes default
	if d, err := strconv.ParseFloat(durationStr, 64); err == nil && d > 0 {
		duration = d
	}

	insights, err := videocore.GenerateVideoInsights(episodeId, duration)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, insights)
}
