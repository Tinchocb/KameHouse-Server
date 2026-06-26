package handlers

import (
	"errors"
	"kamehouse/internal/lore"

	"github.com/labstack/echo/v4"
)

// HandleGetConfigMetadata returns the TMDB ID → series_id mapping used by the lore system.
func (h *Handler) HandleGetConfigMetadata(c echo.Context) error {
	if lore.GetLore() == nil {
		return h.RespondWithError(c, errors.New("lore data not available"))
	}
	return h.RespondWithData(c, map[string]interface{}{
		"tmdb_ids": lore.GetTMDBIDs(),
	})
}
