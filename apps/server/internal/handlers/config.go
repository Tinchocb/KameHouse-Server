package handlers

import (
	"github.com/labstack/echo/v4"
)

// HandleGetConfigMetadata returns the TMDB ID → series_id mapping used by the lore system.
func (h *Handler) HandleGetConfigMetadata(c echo.Context) error {
	return h.RespondWithData(c, map[string]interface{}{
		"tmdb_ids": map[string]interface{}{},
	})
}

