package handlers

import "github.com/labstack/echo/v4"

// RegisterDriveRoutes registers Google Drive endpoints.
func (h *Handler) RegisterDriveRoutes(v1 *echo.Group) {
	if repo := h.App.MediastreamRepository; repo != nil {
		repo.SetDriveSourceFactory(h.driveSubtitleSource)
	}
	drive := v1.Group("/drive")
	drive.GET("/auth-url", h.HandleDriveAuthURL)
	drive.GET("/callback", h.HandleDriveCallback)
	drive.GET("/status", h.HandleDriveStatus)
	drive.POST("/disconnect", h.HandleDriveDisconnect)
	drive.GET("/play", h.HandleDrivePlay)
	drive.HEAD("/play", h.HandleDrivePlay)
	drive.POST("/scan", h.HandleDriveScan)
	drive.GET("/subtitles/status", h.HandleDriveSubtitlesStatus)
	drive.POST("/subtitles/extract", h.HandleDriveSubtitlesExtract)
	drive.POST("/subtitles/cancel", h.HandleDriveSubtitlesCancel)
	drive.POST("/subtitles/window", h.HandleDriveSubtitlesWindow)
}
