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

	// Generate cache key
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(videoPath)))
	cacheFile := filepath.Join(cacheDir, hash+".jpg")

	// 1. Check HTTP Request ETag for returning 304 Not Modified
	fileStat, err := os.Stat(cacheFile)
	if err == nil {
		eTag := fmt.Sprintf(`"%x-%x"`, fileStat.Size(), fileStat.ModTime().UnixNano())
		if match := c.Request().Header.Get("If-None-Match"); match == eTag {
			return c.NoContent(http.StatusNotModified)
		}
		c.Response().Header().Set("ETag", eTag)
	}

	c.Response().Header().Set("Cache-Control", "public, max-age=86400, immutable")

	// 2. Check LRU Memory Cache (Instant 0ms retrieval)
	if imgBytes, found := h.App.ThumbnailCache.Get(hash); found {
		return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
	}

	// 3. Fallback to Disk Cache if FFMpeg already extracted it previously
	if err == nil {
		imgBytes, readErr := os.ReadFile(cacheFile)
		if readErr == nil {
			// Populate LRU cache for next rapid requests
			h.App.ThumbnailCache.Set(hash, imgBytes)
			return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
		}
	}

	// 4. Generate thumbnail via FFMpeg (Cold Cache)
	seekTime := getSeekTimestamp(ffprobePath, videoPath)
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

	// Re-read from disk to serve and place into LRU memory map
	imgBytes, readErr := os.ReadFile(cacheFile)
	if readErr == nil {
		h.App.ThumbnailCache.Set(hash, imgBytes)
		fileStat, err = os.Stat(cacheFile)
		if err == nil {
			eTag := fmt.Sprintf(`"%x-%x"`, fileStat.Size(), fileStat.ModTime().UnixNano())
			c.Response().Header().Set("ETag", eTag)
		}
		return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
	}

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
