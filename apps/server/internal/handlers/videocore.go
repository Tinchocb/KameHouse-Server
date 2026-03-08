package handlers

import (
	"errors"

	"github.com/labstack/echo/v4"
)

// HandleVideoCoreInSightGetCharacterDetails
//
//	@summary returns the character details.
//	@param malId - int - true - "The MAL character ID"
//	@returns videocore.InSightCharacterDetails
//	@route /api/v1/videocore/insight/character/{malId} [GET]
func (h *Handler) HandleVideoCoreInSightGetCharacterDetails(c echo.Context) error {
	return h.RespondWithError(c, errors.New("VideoCore has been removed"))
}
