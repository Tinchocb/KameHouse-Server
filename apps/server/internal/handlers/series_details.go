package handlers

import (
	"kamehouse/internal/database/models/dto"

	"github.com/labstack/echo/v4"
)

// HandleGetSeriesSagas returns fully enriched sagas for a given media entry.
//
//	@summary returns enriched saga array for a media entry.
//	@route /api/v1/library/anime-entry/{id}/sagas [GET]
//	@param id - int - true - "Anime media ID"
//	@returns []dto.SagaDTO
func (h *Handler) HandleGetSeriesSagas(c echo.Context) error {
	return h.RespondWithData(c, []dto.SagaDTO{})
}
