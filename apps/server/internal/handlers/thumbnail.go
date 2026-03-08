package handlers

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// HandleGetVideoThumbnail
//
//	@summary extract a thumbnail from a video file.
//	@desc Extracts a frame from a video file at approximately 5 minutes (or 25% if shorter)
//	@desc and caches it as a JPEG. Returns the cached image on subsequent requests.
//	@route /api/v1/video-thumbnail [GET]
func (h *Handler) HandleGetVideoThumbnail(c echo.Context) error {
	videoPath := c.QueryParam("path")
	if videoPath == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "path parameter is required"})
	}

	// Validate the file exists
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "video file not found"})
	}

	// Get ffmpeg and ffprobe paths from mediastream settings
	ffmpegPath := "ffmpeg"
	ffprobePath := "ffprobe"
	if h.App.SecondarySettings.Mediastream != nil {
		if h.App.SecondarySettings.Mediastream.FfmpegPath != "" {
			ffmpegPath = h.App.SecondarySettings.Mediastream.FfmpegPath
		}
		if h.App.SecondarySettings.Mediastream.FfprobePath != "" {
			ffprobePath = h.App.SecondarySettings.Mediastream.FfprobePath
		}
	}

	// Create cache directory for thumbnails
	cacheDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create cache directory"})
	}

	// Generate cache key from video path
	hash := sha256.Sum256([]byte(videoPath))
	cacheFile := filepath.Join(cacheDir, fmt.Sprintf("%x.jpg", hash))

	// Return cached thumbnail if it exists
	if _, err := os.Stat(cacheFile); err == nil {
		c.Response().Header().Set("Cache-Control", "public, max-age=86400")
		return c.File(cacheFile)
	}

	// Get video duration to determine seek timestamp
	seekTime := getSeekTimestamp(ffprobePath, videoPath)

	// Extract frame with ffmpeg
	cmd := exec.Command(
		ffmpegPath,
		"-ss", seekTime,
		"-i", videoPath,
		"-vframes", "1",
		"-q:v", "5",
		"-vf", "scale=480:-1",
		"-y",
		cacheFile,
	)

	if err := cmd.Run(); err != nil {
		h.App.Logger.Error().Err(err).Str("path", videoPath).Msg("thumbnail: failed to extract frame")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to extract thumbnail"})
	}

	c.Response().Header().Set("Cache-Control", "public, max-age=86400")
	return c.File(cacheFile)
}

// getSeekTimestamp returns the timestamp to seek to for thumbnail extraction.
// Targets 5 minutes, or 25% of duration if the video is shorter than 5 minutes.
func getSeekTimestamp(ffprobePath, videoPath string) string {
	cmd := exec.Command(
		ffprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		videoPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return "00:05:00" // fallback to 5 minutes
	}

	durationStr := strings.TrimSpace(string(output))
	var durationSec float64
	if _, err := fmt.Sscanf(durationStr, "%f", &durationSec); err != nil {
		return "00:05:00"
	}

	targetSec := 300.0 // 5 minutes
	if durationSec < 300 {
		targetSec = durationSec * 0.25
	}

	dur := time.Duration(targetSec * float64(time.Second))
	hours := int(dur.Hours())
	minutes := int(dur.Minutes()) % 60
	seconds := int(dur.Seconds()) % 60

	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
}
