package handlers

import (
	"github.com/labstack/echo/v4"
)

func (h *Handler) HandleTorrentstreamStartStream(c echo.Context) error {
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleTorrentstreamStopStream(c echo.Context) error {
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleTorrentstreamGetStatus(c echo.Context) error {
	return h.RespondWithData(c, nil)
}

func (h *Handler) HandleTorrentstreamGetBatchHistory(c echo.Context) error {
	return h.RespondWithData(c, nil)
}

func (h *Handler) HandleTorrentstreamPreloadStream(c echo.Context) error {
	return h.RespondWithData(c, true)
}
