package handlers

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/ffmpegutil"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

const (
	// Versioned URLs (?v=) change whenever the source file does, so they can be cached forever.
	thumbnailCacheControlImmutable = "public, max-age=31536000, immutable"
	thumbnailCacheControlDefault   = "public, max-age=86400, stale-while-revalidate=604800"

	// Disk eviction works at day granularity; touching more often only adds writes.
	thumbnailTouchMinAge = 24 * time.Hour
	// A file ffmpeg couldn't extract a frame from is not retried on every render.
	thumbnailFailedTTL = 30 * time.Minute
	// How long a flight may wait for a free ffmpeg slot before giving up.
	thumbnailQueueTimeout = 30 * time.Second
)

var (
	thumbnailSingleFlight singleflight.Group
	// singleflight only dedupes identical keys: without this cap a cold grid spawns one
	// ffprobe+ffmpeg per tile at the same time.
	thumbnailGenSem = make(chan struct{}, thumbnailGenConcurrency())
	// hash -> time.Time of the last failed extraction.
	thumbnailFailed sync.Map

	errThumbnailUnavailable = errors.New("thumbnail extraction failed recently")
)

func thumbnailGenConcurrency() int {
	return min(max(runtime.NumCPU()/2, 2), 4)
}

// thumbnailHash identifies one extracted frame: source path, mtime, size and optional offset.
// The disk file, the memory LRU entry and the ETag all derive from it.
func thumbnailHash(videoPath string, videoStat os.FileInfo, offsetSec *int) string {
	key := fmt.Sprintf("%s:%d:%d", videoPath, videoStat.ModTime().UnixNano(), videoStat.Size())
	if offsetSec != nil {
		key = fmt.Sprintf("%s:t=%d", key, *offsetSec)
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(key)))
}

func thumbnailETag(hash string) string {
	return `"` + hash[:16] + `"`
}

// etagMatches reports whether an If-None-Match header lists etag (weak or strong).
func etagMatches(ifNoneMatch, etag string) bool {
	if ifNoneMatch == "" {
		return false
	}
	for _, candidate := range strings.Split(ifNoneMatch, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" || strings.TrimPrefix(candidate, "W/") == etag {
			return true
		}
	}
	return false
}

func thumbnailFailedRecently(hash string) bool {
	at, ok := thumbnailFailed.Load(hash)
	if !ok {
		return false
	}
	if time.Since(at.(time.Time)) < thumbnailFailedTTL {
		return true
	}
	thumbnailFailed.Delete(hash)
	return false
}

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

	var offsetSec *int
	if tParam := c.QueryParam("t"); tParam != "" {
		if sec, parseErr := strconv.Atoi(tParam); parseErr == nil && sec >= 0 {
			offsetSec = &sec
		}
	}

	hash := thumbnailHash(videoPath, videoStat, offsetSec)
	eTag := thumbnailETag(hash)
	cacheControl := thumbnailCacheControlDefault
	if c.QueryParam("v") != "" {
		cacheControl = thumbnailCacheControlImmutable
	}
	// Only on successful responses: an error must never be cached by the browser.
	setCacheHeaders := func() {
		header := c.Response().Header()
		header.Set("ETag", eTag)
		header.Set("Cache-Control", cacheControl)
	}

	// 1. Revalidation: the ETag derives from the source file, so it is known before
	// touching memory or disk.
	if etagMatches(c.Request().Header.Get("If-None-Match"), eTag) {
		setCacheHeaders()
		return c.NoContent(http.StatusNotModified)
	}

	// 2. Memory LRU
	if imgBytes, found := h.App.ThumbnailCache.Get(hash); found {
		setCacheHeaders()
		return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
	}

	// 3. Disk, generating it on a cold cache
	ensuredFile, err := h.ensureThumbnailFile(c.Request().Context(), videoPath, hash, offsetSec)
	if err != nil {
		if errors.Is(err, errThumbnailUnavailable) {
			return h.RespondWithCodeError(c, http.StatusNotFound, err)
		}
		return h.RespondWithCodeError(c, http.StatusInternalServerError, fmt.Errorf("failed to extract thumbnail"))
	}

	imgBytes, readErr := os.ReadFile(ensuredFile)
	if readErr != nil {
		return h.RespondWithCodeError(c, http.StatusInternalServerError, readErr)
	}

	if fileStat, statErr := os.Stat(ensuredFile); statErr == nil {
		cache.TouchDiskCacheIfOlder(ensuredFile, fileStat, thumbnailTouchMinAge)
	}
	h.App.ThumbnailCache.Set(hash, imgBytes)
	setCacheHeaders()
	return c.Blob(http.StatusOK, "image/jpeg", imgBytes)
}

// EnsureThumbnail generates or returns the cached thumbnail path for a given video file.
func (h *Handler) EnsureThumbnail(videoPath string) (string, error) {
	return h.EnsureThumbnailWithOffset(context.Background(), videoPath, nil)
}

// EnsureThumbnailWithContext generates or returns the cached thumbnail path with context cancellation support.
func (h *Handler) EnsureThumbnailWithContext(parentCtx context.Context, videoPath string) (string, error) {
	return h.EnsureThumbnailWithOffset(parentCtx, videoPath, nil)
}

// EnsureThumbnailWithOffset generates or returns the cached thumbnail path at an optional second offset.
func (h *Handler) EnsureThumbnailWithOffset(parentCtx context.Context, videoPath string, offsetSec *int) (string, error) {
	if parentCtx.Err() != nil {
		return "", parentCtx.Err()
	}

	videoStat, err := os.Stat(videoPath)
	if err != nil {
		return "", err
	}

	return h.ensureThumbnailFile(parentCtx, videoPath, thumbnailHash(videoPath, videoStat, offsetSec), offsetSec)
}

// ensureThumbnailFile returns the disk path of the thumbnail identified by hash, extracting
// it with ffmpeg when missing. parentCtx only bounds how long the caller waits: the
// extraction itself is shared and keeps running if that caller goes away.
func (h *Handler) ensureThumbnailFile(parentCtx context.Context, videoPath string, hash string, offsetSec *int) (string, error) {
	cacheDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return "", err
	}
	cacheFile := filepath.Join(cacheDir, hash+".jpg")

	// 1. Check if cache file already exists
	if _, err := os.Stat(cacheFile); err == nil {
		return cacheFile, nil
	}

	// 2. Backward compatibility fallback: check for legacy hash (videoPath only) when offsetSec is nil
	if offsetSec == nil {
		legacyHash := fmt.Sprintf("%x", sha256.Sum256([]byte(videoPath)))
		legacyCacheFile := filepath.Join(cacheDir, legacyHash+".jpg")
		if _, err := os.Stat(legacyCacheFile); err == nil {
			_ = os.Rename(legacyCacheFile, cacheFile)
			return cacheFile, nil
		}
	}

	if parentCtx.Err() != nil {
		return "", parentCtx.Err()
	}
	if thumbnailFailedRecently(hash) {
		return "", errThumbnailUnavailable
	}

	// 3. Cold cache: generate via FFMpeg with singleflight deduplication
	flight := thumbnailSingleFlight.DoChan(hash, func() (interface{}, error) {
		// Double check if created while waiting
		if _, err := os.Stat(cacheFile); err == nil {
			return cacheFile, nil
		}

		// Detached from the request: other callers may be waiting on this flight, and a
		// viewer scrolling past the tile must not kill the extraction for everyone.
		baseCtx := context.WithoutCancel(parentCtx)

		queueCtx, cancelQueue := context.WithTimeout(baseCtx, thumbnailQueueTimeout)
		defer cancelQueue()
		select {
		case thumbnailGenSem <- struct{}{}:
			defer func() { <-thumbnailGenSem }()
		case <-queueCtx.Done():
			return nil, queueCtx.Err()
		}

		var customFfmpeg, customFfprobe string
		if h.App.SecondarySettings.Mediastream != nil {
			customFfmpeg = h.App.SecondarySettings.Mediastream.FfmpegPath
			customFfprobe = h.App.SecondarySettings.Mediastream.FfprobePath
		}
		ffmpegPath := ffmpegutil.ResolveFFmpegPath(h.App.Config.Cache.Dir, customFfmpeg)
		ffprobePath := ffmpegutil.ResolveFFprobePath(h.App.Config.Cache.Dir, customFfprobe)

		var seekTime string
		if offsetSec != nil {
			seekTime = formatSeekTimestamp(time.Duration(*offsetSec) * time.Second)
		} else {
			seekTime = getSeekTimestamp(baseCtx, ffprobePath, videoPath)
		}

		ctx, cancel := context.WithTimeout(baseCtx, 15*time.Second)
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
			thumbnailFailed.Store(hash, time.Now())
			h.App.Logger.Error().Err(err).Str("path", videoPath).Str("output", string(out)).Msg("thumbnail: failed to extract frame")
			return nil, err
		}

		if err := os.Rename(tmpCacheFile, cacheFile); err != nil {
			_ = os.Remove(tmpCacheFile)
			return nil, err
		}

		return cacheFile, nil
	})

	select {
	case res := <-flight:
		if res.Err != nil {
			return "", res.Err
		}
		return cacheFile, nil
	case <-parentCtx.Done():
		return "", parentCtx.Err()
	}
}

// clearThumbnailFailures forgets failed extractions, e.g. after a manual cache purge.
func clearThumbnailFailures() {
	thumbnailFailed.Clear()
}

func formatSeekTimestamp(dur time.Duration) string {
	hours := int(dur.Hours())
	minutes := int(dur.Minutes()) % 60
	seconds := int(dur.Seconds()) % 60
	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
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

	return formatSeekTimestamp(time.Duration(targetSec * float64(time.Second)))
}
