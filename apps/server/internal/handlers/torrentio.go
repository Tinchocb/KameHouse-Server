package handlers

import (
	"github.com/labstack/echo/v4"
)

type TorrentioHandler struct {
}

func NewTorrentioHandler() *TorrentioHandler {
	return &TorrentioHandler{}
}

func (h *TorrentioHandler) GetStreams(c echo.Context) error {
	return c.JSON(200, []string{})
}
