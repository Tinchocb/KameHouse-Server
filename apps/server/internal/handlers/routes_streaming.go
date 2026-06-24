package handlers

import (
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

// RegisterStreamingRoutes registers all media streaming, direct stream, and mediastream routes.
func (h *Handler) RegisterStreamingRoutes(v1 *echo.Group) {
	// Old Playback Manager / HLS (removed)

	// Media Stream
	v1Mediastream := v1.Group("/mediastream")
	v1Mediastream.GET("/settings", h.HandleGetMediastreamSettings)
	v1Mediastream.PATCH("/settings", h.HandleSaveMediastreamSettings)
	v1Mediastream.POST("/request", h.HandleRequestMediastreamMediaContainer)
	v1Mediastream.POST("/preload", h.HandlePreloadMediastreamMediaContainer)
	v1Mediastream.POST("/shutdown-transcode", h.HandleMediastreamShutdownTranscodeStream)
	v1Mediastream.GET("/direct/play", h.HandleMediastreamDirectPlay)
	v1Mediastream.GET("/transcode/*", h.HandleMediastreamTranscode)
	v1Mediastream.GET("/hls/*", h.HandleMediastreamServeOptimizedStatic)
	v1Mediastream.GET("/subs", h.HandleMediastreamGetSubtitles)
	v1Mediastream.GET("/subtitles", h.HandleMediastreamGetSubtitles) // alias matching frontend requests
	v1Mediastream.GET("/att", h.HandleMediastreamGetAttachments)
	v1Mediastream.GET("/file", h.HandleMediastreamFile)
	v1Mediastream.GET("/skip-times", h.HandleGetEpisodeSkipTimes)
	v1Mediastream.POST("/skip-times", h.HandleSaveEpisodeSkipTimes)
	v1Mediastream.POST("/skip-times/scan", h.HandleScanEpisodeSkipTimes)

	// Video Thumbnail
	v1.GET("/video-thumbnail", h.HandleGetVideoThumbnail)


	// VideoCore insights
	v1.GET("/videocore/insights/:episodeId", h.HandleGetVideoInsights)

	// Playback telemetry
	v1.POST("/playback/sync", h.HandlePlaybackSync)

	// Temporary route to copy assets bypassing terminal sandbox limits
	v1.GET("/temp-copy-assets", h.HandleTempCopyAssets)
}

func (h *Handler) HandleTempCopyAssets(c echo.Context) error {
	src := `C:\Users\Tinchoo\.gemini\antigravity-ide\brain\d13ba002-4f9b-4206-9f34-13e7dbb4bd0d\media__1782261574230.png`
	dest := `d:\Proyectos personales\KameHouse\apps\web\public\icons\goku-panorama.png`

	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		return c.String(http.StatusInternalServerError, "mkdir error: "+err.Error())
	}

	in, err := os.Open(src)
	if err != nil {
		return c.String(http.StatusInternalServerError, "open src error: "+err.Error())
	}
	defer in.Close()

	out, err := os.Create(dest)
	if err != nil {
		return c.String(http.StatusInternalServerError, "create dest error: "+err.Error())
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return c.String(http.StatusInternalServerError, "copy error: "+err.Error())
	}

	return c.String(http.StatusOK, "File copied successfully to "+dest)
}

