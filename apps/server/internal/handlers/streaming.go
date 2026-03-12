package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"kamehouse/internal/database/db"
	"kamehouse/internal/streaming"

	"github.com/labstack/echo/v4"
)

// HandleStreamingPlay
//
//	@summary Orchestrates streaming playback
//	@desc Returns direct URL or HLS master URL based on client capabilities
//	@returns streaming.OrchestratorResult
//	@route /api/v1/media/:id/play [GET]
func (h *Handler) HandleStreamingPlay(c echo.Context) error {
	mediaIdStr := c.Param("id")
	mediaId, err := strconv.Atoi(mediaIdStr)
	if err != nil {
		return h.RespondWithError(c, fmt.Errorf("invalid media ID"))
	}

	userAgent := c.Request().Header.Get("User-Agent")

	// Create a dummy client profile (Web Browser Default)
	// Usually parsed from User-Agent or explicitly requested
	clientProfile := &streaming.ClientProfile{
		Name:            "Web Browser",
		SupportedVideo:  []string{"h264"},
		SupportedAudio:  []string{"aac", "mp3"},
		SupportedFormat: []string{"mp4", "webm"},
	}

	if strings.Contains(userAgent, "KameHouseApp") {
		// Native apps support MKV and HEVC usually
		clientProfile.SupportedVideo = append(clientProfile.SupportedVideo, "hevc", "h265")
		clientProfile.SupportedFormat = append(clientProfile.SupportedFormat, "mkv", "matroska")
	}

	result, err := h.App.StreamOrchestrator.Orchestrate(c.Request().Context(), mediaId, clientProfile)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, result)
}

// HandleStreamingDirect
//
//	@summary Serves media directly
//	@route /api/v1/media/:id/direct [GET]
func (h *Handler) HandleStreamingDirect(c echo.Context) error {
	mediaIdStr := c.Param("id")
	mediaId, err := strconv.Atoi(mediaIdStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid media ID")
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get local files")
	}

	var targetFile string
	for _, l := range lfs {
		if l.MediaId == mediaId && l.IsMain() {
			targetFile = l.GetNormalizedPath()
			break
		}
	}

	if targetFile == "" || !fileExists(targetFile) {
		return echo.NewHTTPError(http.StatusNotFound, "media file not found")
	}

	return c.File(targetFile)
}

// HandleStreamingHLS
//
//	@summary Serves transcoded HLS segments
//	@route /api/v1/media/:id/hls/* [GET]
func (h *Handler) HandleStreamingHLS(c echo.Context) error {
	mediaIdStr := c.Param("id")
	fileToken := c.Param("*") // "master.m3u8" or "segment_000.ts"

	// /tmp/kamehouse_transcodes/{id}/{file}
	targetFile := filepath.Join("/tmp/kamehouse_transcodes", mediaIdStr, fileToken)

	if !fileExists(targetFile) {
		return echo.NewHTTPError(http.StatusNotFound, "segment not found")
	}

	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")

	return c.File(targetFile)
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}
