package handlers

import (
	"encoding/json"
	"kamehouse/internal/lore"

	"github.com/labstack/echo/v4"
)

// HandleGetDragonBallLore handles the request to fetch the complete Dragon Ball lore database.
func (h *Handler) HandleGetDragonBallLore(c echo.Context) error {
	var l map[string]interface{}
	if err := json.Unmarshal(lore.GetDragonBallLoreJSON(), &l); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, l)
}


