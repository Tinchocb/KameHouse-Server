package handlers

import "github.com/labstack/echo/v4"

// RegisterDriveRoutes registers Google Drive endpoints.
func (h *Handler) RegisterDriveRoutes(v1 *echo.Group) {
	drive := v1.Group("/drive")
	drive.GET("/auth-url", h.HandleDriveAuthURL)
	drive.GET("/callback", h.HandleDriveCallback)
	drive.POST("/callback", h.HandleDriveCallback)
	drive.GET("/status", h.HandleDriveStatus)
	drive.POST("/disconnect", h.HandleDriveDisconnect)
	drive.GET("/play", h.HandleDrivePlay)
	drive.HEAD("/play", h.HandleDrivePlay)
	drive.POST("/scan", h.HandleDriveScan)
}
