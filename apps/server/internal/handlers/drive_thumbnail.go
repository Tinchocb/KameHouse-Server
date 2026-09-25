package handlers

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/util/cache"

	"github.com/labstack/echo/v4"
)

const (
	driveThumbWidth      = 480
	driveThumbMissingTTL = 30 * time.Minute
)

var (
	// A series page asks for every episode at once; cap concurrent Drive fetches so a
	// cold cache doesn't burst the API quota.
	driveThumbSem = make(chan struct{}, 4)
	// Remembers files Drive has no thumbnail for, so we don't re-ask on every render.
	driveThumbMissing sync.Map // hash -> time.Time
)

// serveDriveThumbnail serves Drive's own preview frame for an indexed gdrive:// file,
// caching it on disk and in memory like locally extracted thumbnails.
func (h *Handler) serveDriveThumbnail(c echo.Context, videoPath string) error {
	// Only serve files we indexed: this also stops the endpoint from being used to
	// probe arbitrary Drive file IDs.
	var lf models.LocalFile
	if err := h.App.Database.Gorm().Select("drive_file_id", "file_mod_time").
		Where("path = ?", videoPath).First(&lf).Error; err != nil || lf.DriveFileID == "" {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("video file not found"))
	}

	hash := fmt.Sprintf("%x", sha256.Sum256(fmt.Appendf(nil, "gdrive:%s:%d:%d", lf.DriveFileID, lf.FileModTime, driveThumbWidth)))
	eTag := thumbnailETag(hash)
	cacheControl := thumbnailCacheControlDefault
	if c.QueryParam("v") != "" {
		cacheControl = thumbnailCacheControlImmutable
	}
	// Only on successful responses: a transient Drive error must never be cached by the browser.
	setCacheHeaders := func() {
		header := c.Response().Header()
		header.Set("ETag", eTag)
		header.Set("Cache-Control", cacheControl)
	}
	serve := func(imgBytes []byte) error {
		setCacheHeaders()
		return c.Blob(http.StatusOK, http.DetectContentType(imgBytes), imgBytes)
	}

	if etagMatches(c.Request().Header.Get("If-None-Match"), eTag) {
		setCacheHeaders()
		return c.NoContent(http.StatusNotModified)
	}

	if imgBytes, found := h.App.ThumbnailCache.Get(hash); found {
		return serve(imgBytes)
	}

	cacheFile := filepath.Join(h.App.Config.Cache.Dir, "thumbnails", "gdrive-"+hash+".jpg")
	if imgBytes, err := os.ReadFile(cacheFile); err == nil {
		if info, statErr := os.Stat(cacheFile); statErr == nil {
			cache.TouchDiskCacheIfOlder(cacheFile, info, thumbnailTouchMinAge)
		}
		h.App.ThumbnailCache.Set(hash, imgBytes)
		return serve(imgBytes)
	}

	if at, ok := driveThumbMissing.Load(hash); ok && time.Since(at.(time.Time)) < driveThumbMissingTTL {
		return h.RespondWithCodeError(c, http.StatusNotFound, drive.ErrNoThumbnail)
	}

	v, err, _ := thumbnailSingleFlight.Do(hash, func() (interface{}, error) {
		client, err := h.App.DriveService.GetClient()
		if err != nil {
			return nil, err
		}
		// Detached from the request: other callers may be waiting on this flight.
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		select {
		case driveThumbSem <- struct{}{}:
			defer func() { <-driveThumbSem }()
		case <-ctx.Done():
			return nil, ctx.Err()
		}

		imgBytes, err := client.GetThumbnail(ctx, lf.DriveFileID, driveThumbWidth)
		if err != nil {
			return nil, err
		}
		if err := os.MkdirAll(filepath.Dir(cacheFile), 0755); err == nil {
			tmp := fmt.Sprintf("%s.%d.tmp", cacheFile, time.Now().UnixNano())
			if os.WriteFile(tmp, imgBytes, 0644) == nil && os.Rename(tmp, cacheFile) != nil {
				_ = os.Remove(tmp)
			}
		}
		return imgBytes, nil
	})
	if err != nil {
		if errors.Is(err, drive.ErrNoThumbnail) {
			driveThumbMissing.Store(hash, time.Now())
			return h.RespondWithCodeError(c, http.StatusNotFound, err)
		}
		h.App.Logger.Debug().Err(err).Str("path", videoPath).Msg("thumbnail: failed to fetch Drive thumbnail")
		return h.RespondWithCodeError(c, http.StatusBadGateway, err)
	}

	imgBytes := v.([]byte)
	h.App.ThumbnailCache.Set(hash, imgBytes)
	return serve(imgBytes)
}
