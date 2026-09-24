package handlers

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/ffmpegutil"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

var thumbnailSingleFlight singleflight.Group

// HandleGetVideoThumbnail ...
//
//	@summary extract a thumbnail from a video file.
//	@desc Extracts a frame from a video file at approximately 5 minutes (or 25% if shorter)
//	@desc and caches it as a JPEG. Returns the cached image on subsequent requests.
//	@route /api/v1/video-thumbnail [GET]
func (h *Handler) HandleGetVideoThumbnail(c echo.Context) error {
	videoPath := c.QueryParam("path")
	if videoPath == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("path parameter is required"))
	}

	if strings.HasPrefix(videoPath, "gdrive://") {
		if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
			return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("google drive integration is not active"))
		}
		return h.serveDriveThumbnail(c, videoPath)
	}

	// Validate the file exists
	videoStat, err := os.Stat(videoPath)
	if err != nil {
		if os.IsNotExist(err) {
			return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("video file not found"))
		}
		return h.RespondWithCodeError(c, http.StatusInternalServerError, err)
	}

	// Prevent path traversal: ensure the path belongs to one of the configured library paths
	libraryPaths, err := h.App.Database.GetAllLibraryPathsFromSettings()
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusInternalServerError, errors.New("failed to retrieve library paths"))
	}

	isPathAllowed := false
	for _, libPath := range libraryPaths {
		if util.IsFileUnderDir(libPath, videoPath) {
			isPathAllowed = true
			break
		}
	}

	if !isPathAllowed {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access denied to the requested file path"))
	}

	// 1. Check LRU Memory Cache (Instant 0ms retrieval)
	cacheKey := fmt.Sprintf("%s:%d:%d", videoPath, videoStat.ModTime().UnixNano(), videoStat.Size())
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(cacheKey)))

	if imgBytes, found := h.App.ThumbnailCache.Get(hash); found {
		c.Response().Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
		return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
	}

	// 2. Ensure thumbnail exists on disk (cold cache or migration fallback)
	ensuredFile, err := h.EnsureThumbnail(videoPath)
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusInternalServerError, fmt.Errorf("failed to extract thumbnail"))
	}

	// 3. Check HTTP Request ETag for returning 304 Not Modified
	fileStat, err := os.Stat(ensuredFile)
	if err == nil {
		eTag := fmt.Sprintf(`"%x-%x"`, fileStat.Size(), fileStat.ModTime().UnixNano())
		if match := c.Request().Header.Get("If-None-Match"); match == eTag {
			cache.TouchDiskCache(ensuredFile)
			return c.NoContent(http.StatusNotModified)
		}
		c.Response().Header().Set("ETag", eTag)
	}

	c.Response().Header().Set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")

	// 4. Read image bytes, populate memory LRU cache, and serve
	imgBytes, readErr := os.ReadFile(ensuredFile)
	if readErr != nil {
		return h.RespondWithCodeError(c, http.StatusInternalServerError, readErr)
	}

	cache.TouchDiskCache(ensuredFile)
	h.App.ThumbnailCache.Set(hash, imgBytes)
	return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
}

// EnsureThumbnail generates or returns the cached thumbnail path for a given video file.
func (h *Handler) EnsureThumbnail(videoPath string) (string, error) {
	return h.EnsureThumbnailWithContext(context.Background(), videoPath)
}

// EnsureThumbnailWithContext generates or returns the cached thumbnail path with context cancellation support.
func (h *Handler) EnsureThumbnailWithContext(parentCtx context.Context, videoPath string) (string, error) {
	if parentCtx.Err() != nil {
		return "", parentCtx.Err()
	}

	videoStat, err := os.Stat(videoPath)
	if err != nil {
		return "", err
	}

	cacheDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return "", err
	}

	// Generate cache key based on path, mtime, and size (O(1))
	cacheKey := fmt.Sprintf("%s:%d:%d", videoPath, videoStat.ModTime().UnixNano(), videoStat.Size())
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(cacheKey)))
	cacheFile := filepath.Join(cacheDir, hash+".jpg")

	// 1. Check if cache file already exists
	if _, err := os.Stat(cacheFile); err == nil {
		return cacheFile, nil
	}

	// 2. Backward compatibility fallback: check for legacy hash (videoPath only)
	legacyHash := fmt.Sprintf("%x", sha256.Sum256([]byte(videoPath)))
	legacyCacheFile := filepath.Join(cacheDir, legacyHash+".jpg")
	if _, err := os.Stat(legacyCacheFile); err == nil {
		_ = os.Rename(legacyCacheFile, cacheFile)
		return cacheFile, nil
	}

	if parentCtx.Err() != nil {
		return "", parentCtx.Err()
	}

	// 3. Cold cache: generate via FFMpeg with singleflight deduplication
	_, sfErr, _ := thumbnailSingleFlight.Do(hash, func() (interface{}, error) {
		// Double check if created while waiting
		if _, err := os.Stat(cacheFile); err == nil {
			return cacheFile, nil
		}
		if parentCtx.Err() != nil {
			return nil, parentCtx.Err()
		}

		var customFfmpeg, customFfprobe string
		if h.App.SecondarySettings.Mediastream != nil {
			customFfmpeg = h.App.SecondarySettings.Mediastream.FfmpegPath
			customFfprobe = h.App.SecondarySettings.Mediastream.FfprobePath
		}
		ffmpegPath := ffmpegutil.ResolveFFmpegPath(h.App.Config.Cache.Dir, customFfmpeg)
		ffprobePath := ffmpegutil.ResolveFFprobePath(h.App.Config.Cache.Dir, customFfprobe)

		seekTime := getSeekTimestamp(parentCtx, ffprobePath, videoPath)

		ctx, cancel := context.WithTimeout(parentCtx, 15*time.Second)
		defer cancel()

		tmpCacheFile := fmt.Sprintf("%s.%d.tmp", cacheFile, time.Now().UnixNano())
		cmd := util.NewCmdCtx(
			ctx,
			ffmpegPath,
			"-ss", seekTime,
			"-i", videoPath,
			"-vframes", "1",
			"-q:v", "5",
			"-vf", "scale=480:-2",
			"-y",
			tmpCacheFile,
		)

		if out, err := cmd.CombinedOutput(); err != nil {
			_ = os.Remove(tmpCacheFile)
			h.App.Logger.Error().Err(err).Str("path", videoPath).Str("output", string(out)).Msg("thumbnail: failed to extract frame")
			return nil, err
		}

		if err := os.Rename(tmpCacheFile, cacheFile); err != nil {
			_ = os.Remove(tmpCacheFile)
			return nil, err
		}

		return cacheFile, nil
	})

	if sfErr != nil {
		return "", sfErr
	}

	return cacheFile, nil
}

// getSeekTimestamp returns the timestamp to seek to for thumbnail extraction.
// Targets 5 minutes, or 25% of duration if the video is shorter than 5 minutes.
func getSeekTimestamp(parentCtx context.Context, ffprobePath, videoPath string) string {
	ctx, cancel := context.WithTimeout(parentCtx, 5*time.Second)
	defer cancel()

	cmd := util.NewCmdCtx(
		ctx,
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
