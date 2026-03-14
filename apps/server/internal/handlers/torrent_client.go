package handlers

import (
	"github.com/labstack/echo/v4"
)

func (h *Handler) HandleTorrentClientDeselectAndDownload(c echo.Context) error {
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleTorrentClientSmartSelect(c echo.Context) error {
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleTorrentClientSelectFiles(c echo.Context) error {
	return h.RespondWithData(c, true)
}
