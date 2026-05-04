package handlers

import "github.com/labstack/echo/v4"

// RegisterLocalRoutes registers local-sync, continuity, and local-platform routes.
func (h *Handler) RegisterLocalRoutes(v1 *echo.Group) {
	// Local sync
	v1Local := v1.Group("/local")
	v1Local.POST("/offline", h.HandleSetOfflineMode)
	v1Local.GET("/track", h.HandleLocalGetTrackedMediaItems)
	v1Local.POST("/track", h.HandleLocalAddTrackedMedia)
	v1Local.DELETE("/track", h.HandleLocalRemoveTrackedMedia)
	v1Local.GET("/track/:id/:type", h.HandleLocalGetIsMediaTracked)
	v1Local.POST("/local", h.HandleLocalSyncData)
	v1Local.GET("/queue", h.HandleLocalGetSyncQueueState)
	v1Local.POST("/platform", h.HandleLocalSyncPlatformData)
	v1Local.POST("/sync-simulated-to-platform", h.HandleLocalSyncSimulatedDataToPlatform)
	v1Local.POST("/updated", h.HandleLocalSetHasLocalChanges)
	v1Local.GET("/updated", h.HandleLocalGetHasLocalChanges)
	v1Local.GET("/storage/size", h.HandleLocalGetLocalStorageSize)

	// Continuity (watch history)
	v1Continuity := v1.Group("/continuity")
	v1Continuity.PATCH("/item", h.HandleUpdateContinuityWatchHistoryItem)
	v1Continuity.GET("/item/:id", h.HandleGetContinuityWatchHistoryItem)
	v1Continuity.GET("/history", h.HandleGetContinuityWatchHistory)
}
