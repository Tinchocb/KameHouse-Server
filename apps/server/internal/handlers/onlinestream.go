package handlers

import (
	"errors"

	"github.com/labstack/echo/v4"
)

func (h *Handler) HandleGetOnlineStreamEpisodeList(c echo.Context) error {
	return h.RespondWithError(c, errors.New("online streaming is disabled"))
}

func (h *Handler) HandleGetOnlineStreamEpisodeSource(c echo.Context) error {
	return h.RespondWithError(c, errors.New("online streaming is disabled"))
}

func (h *Handler) HandleOnlineStreamEmptyCache(c echo.Context) error {
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleOnlinestreamManualSearch(c echo.Context) error {
	return h.RespondWithError(c, errors.New("online streaming is disabled"))
}

func (h *Handler) HandleOnlinestreamManualMapping(c echo.Context) error {
	return h.RespondWithError(c, errors.New("online streaming is disabled"))
}

func (h *Handler) HandleGetOnlinestreamMapping(c echo.Context) error {
	return h.RespondWithData(c, nil)
}

func (h *Handler) HandleRemoveOnlinestreamMapping(c echo.Context) error {
	return h.RespondWithData(c, true)
}
