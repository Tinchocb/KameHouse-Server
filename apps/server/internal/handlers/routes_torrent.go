package handlers

import (
	"github.com/labstack/echo/v4"
)

func (h *Handler) RegisterTorrentClientRoutes(v1 *echo.Group) {
	tc := v1.Group("/torrent-client")
	tc.POST("/action", h.HandleTorrentClientAction)
	tc.POST("/get-files", h.HandleTorrentClientGetFiles)
	tc.POST("/download", h.HandleTorrentClientDownload)
	tc.POST("/rule-magnet", h.HandleTorrentClientRuleMagnet)
	tc.POST("/upload", h.HandleTorrentClientUploadFile) // Added explicit file upload endpoint
}
