package handlers

import "github.com/labstack/echo/v4"

// RegisterSettingsRoutes registers settings, auth, and system routes.
func (h *Handler) RegisterSettingsRoutes(v1 *echo.Group) {
	// Settings
	v1.GET("/settings", h.HandleGetSettings)
	v1.PATCH("/settings", h.HandleSaveSettings)
	v1.POST("/start", h.HandleGettingStarted)

	// Progress
	v1.GET("/progress", h.HandleGetProgress)
	v1.POST("/progress", h.HandleSaveProgress)

	// Metadata
	v1.POST("/metadata-provider/filler", h.HandlePopulateFillerData)
	v1.DELETE("/metadata-provider/filler", h.HandleRemoveFillerData)
	v1.GET("/metadata/parent/:id", h.HandleGetMediaMetadataParent)
	v1.POST("/metadata/parent", h.HandleSaveMediaMetadataParent)
	v1.DELETE("/metadata/parent", h.HandleDeleteMediaMetadataParent)
	v1.DELETE("/metadata/cache", h.HandleClearMetadataCache)

	// TMDB
	v1TMDB := v1.Group("/tmdb")
	v1TMDB.POST("/search", h.HandleTMDBSearch)
	v1TMDB.POST("/details", h.HandleTMDBGetDetails)
	v1TMDB.GET("/images/:type/:id", h.HandleTMDBImages)
	v1TMDB.GET("/episode/:tvId/:absolute", h.HandleTMDBEpisodeStill)

	// AniList (sin API key; red de seguridad para miniaturas de episodios)
	v1AniList := v1.Group("/anilist")
	v1AniList.GET("/episode/:anilistId/:absolute", h.HandleAniListEpisodeThumbnail)

	// System
	v1System := v1.Group("/db")
	v1System.POST("/backup", h.HandleBackupDatabase)
	v1System.GET("/backup/download", h.HandleDownloadDatabaseBackup)
	v1.GET("/report", h.HandleGetDiagnosticsReport)
}
