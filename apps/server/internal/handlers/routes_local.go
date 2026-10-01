package handlers

import "github.com/labstack/echo/v4"

// RegisterLocalRoutes registers local-sync, continuity, and local-platform routes.
func (h *Handler) RegisterLocalRoutes(v1 *echo.Group) {
	// Continuity (watch history)
	v1Continuity := v1.Group("/continuity")
	v1Continuity.PATCH("/item", h.HandleUpdateContinuityWatchHistoryItem)
	v1Continuity.GET("/item/:id", h.HandleGetContinuityWatchHistoryItem)
	v1Continuity.GET("/history", h.HandleGetContinuityWatchHistory)
}
