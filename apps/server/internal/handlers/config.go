package handlers

import (
	"errors"

	"github.com/labstack/echo/v4"
)

// HandleGetConfigMetadata returns the TMDB ID → series_id mapping used by the lore system.
func (h *Handler) HandleGetConfigMetadata(c echo.Context) error {
	return h.RespondWithCodeError(c, 501, errors.New("config metadata not implemented"))
}

