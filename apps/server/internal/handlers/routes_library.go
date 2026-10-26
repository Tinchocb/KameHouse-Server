package handlers

import "github.com/labstack/echo/v4"

// RegisterLibraryRoutes registers all library, local-files, and explorer routes.
func (h *Handler) RegisterLibraryRoutes(v1 *echo.Group) {
	v1Library := v1.Group("/library")

	v1Library.POST("/scan", h.HandleScanLocalFiles)
	v1Library.GET("/unlinked", h.HandleGetUnlinkedFiles)
	v1Library.POST("/unlinked/resolve", h.HandleResolveUnlinkedFile)

	v1Library.POST("/local-files/tmdb-assign", h.HandleTMDBAssign)

	v1Library.GET("/collection", h.HandleGetLibraryCollection)
	v1Library.GET("/episode-file", h.HandleGetLibraryEpisodeFile)
	v1Library.GET("/chronology-episode-files", h.HandleGetChronologyEpisodeFiles)

	v1Library.GET("/anime-entry/:id", h.HandleGetAnimeEntry)
	v1Library.GET("/anime-entry/:id/sagas", h.HandleGetSeriesSagas)
	v1Library.GET("/anime-entry/:id/local-files", h.HandleGetAnimeEntryLocalFiles)
	v1Library.GET("/anime-entry/:id/source", h.HandleGetAnimeEntrySource)
	v1Library.POST("/anime-entry/source", h.HandleSetAnimeEntrySource)
	v1Library.POST("/anime-entry/progress", h.HandleUpdateAnimeEntryProgress)

	v1Library.GET("/audio-profiles", h.HandleGetAudioProfiles)
	v1Library.POST("/audio-profile", h.HandleSetAudioProfile)
}
