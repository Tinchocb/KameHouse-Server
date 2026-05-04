package handlers

import (
	"github.com/labstack/echo/v4"
)

// RegisterStreamingRoutes registers all media streaming, direct stream, and mediastream routes.
func (h *Handler) RegisterStreamingRoutes(v1 *echo.Group) {
	// Playback Manager / HLS
	v1.GET("/stream/:id/master.m3u8", h.HandleMasterPlaylist)
	v1.GET("/stream/:id/:file", h.HandleHlsSegment)
	v1.DELETE("/stream/:id", h.StopStreamSession)

	// Media Stream
	v1Mediastream := v1.Group("/mediastream")
	v1Mediastream.GET("/settings", h.HandleGetMediastreamSettings)
	v1Mediastream.PATCH("/settings", h.HandleSaveMediastreamSettings)
	v1Mediastream.POST("/request", h.HandleRequestMediastreamMediaContainer)
	v1Mediastream.POST("/preload", h.HandlePreloadMediastreamMediaContainer)
	v1Mediastream.POST("/shutdown-transcode", h.HandleMediastreamShutdownTranscodeStream)
	v1Mediastream.GET("/direct/play", h.HandleMediastreamDirectPlay)
	v1Mediastream.GET("/transcode/*", h.HandleMediastreamTranscode)
	v1Mediastream.GET("/subs", h.HandleMediastreamGetSubtitles)
	v1Mediastream.GET("/att", h.HandleMediastreamGetAttachments)
	v1Mediastream.GET("/file", h.HandleMediastreamFile)

	// Video Thumbnail
	v1.GET("/video-thumbnail", h.HandleGetVideoThumbnail)

	// Addons
	v1.GET("/addons/subtitles/:type/:id", h.HandleGetAddonSubtitles)

	// VideoCore insights
	v1.GET("/videocore/insight/character/:malId", h.HandleVideoCoreInSightGetCharacterDetails)
	v1.GET("/videocore/insights/:episodeId", h.HandleGetVideoInsights)

	// Playback telemetry
	v1.POST("/playback/sync", h.HandlePlaybackSync)
}
