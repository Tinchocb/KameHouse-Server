package handlers

import (
	"errors"
	"kamehouse/internal/library/anime"

	"github.com/labstack/echo/v4"
)

// HandleGetHomeCurated returns the intelligent swimlanes for the home page.
func (h *Handler) HandleGetHomeCurated(c echo.Context) error {
	ctx := c.Request().Context()

	if h.App.Database == nil {
		return c.JSON(500, NewErrorResponse(errors.New("database not initialized")))
	}

	resp, err := anime.GetCuratedHome(ctx, h.App.Database)
	if err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}

	return c.JSON(200, NewDataResponse(resp))
}
