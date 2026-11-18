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

	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
)

const (
	driveThumbWidth      = 480
	driveThumbMissingTTL = 30 * time.Minute
	// Un archivo al que Drive no le generó frame se recuerda también en disco, para que el
	// precalentado de cada arranque no vuelva a preguntar por él.
	driveThumbMissingDiskTTL = 7 * 24 * time.Hour
)

var (
	// A series page asks for every episode at once; cap concurrent Drive fetches so a
	// cold cache doesn't burst the API quota.
	driveThumbSem = make(chan struct{}, 4)
	// Remembers files Drive has no thumbnail for, so we don't re-ask on every render.
	driveThumbMissing = result.NewBoundedCache[string, bool](2048)
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

	hash := driveThumbnailHash(lf.DriveFileID, lf.FileModTime)
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

	cacheFile := driveThumbnailCacheFile(h.App.Config.Cache.Dir, hash)
	if imgBytes, err := os.ReadFile(cacheFile); err == nil {
		if info, statErr := os.Stat(cacheFile); statErr == nil {
			cache.TouchDiskCacheIfOlder(cacheFile, info, thumbnailTouchMinAge)
		}
		h.App.ThumbnailCache.Set(hash, imgBytes)
		return serve(imgBytes)
	}

	imgBytes, err := h.fetchDriveThumbnail(hash, cacheFile, lf.DriveFileID)
	if err != nil {
		if errors.Is(err, drive.ErrNoThumbnail) {
			return h.RespondWithCodeError(c, http.StatusNotFound, err)
		}
		h.App.Logger.Debug().Err(err).Str("path", videoPath).Msg("thumbnail: failed to fetch Drive thumbnail")
		return h.RespondWithCodeError(c, http.StatusBadGateway, err)
	}

	h.App.ThumbnailCache.Set(hash, imgBytes)
	return serve(imgBytes)
}

// driveThumbnailHash identifica el frame de un archivo de Drive: id, mtime y ancho.
func driveThumbnailHash(driveFileID string, fileModTime int64) string {
	return fmt.Sprintf("%x", sha256.Sum256(fmt.Appendf(nil, "gdrive:%s:%d:%d", driveFileID, fileModTime, driveThumbWidth)))
}

func driveThumbnailCacheFile(cacheDir, hash string) string {
	return filepath.Join(cacheDir, "thumbnails", "gdrive-"+hash+".jpg")
}

// fetchDriveThumbnail baja el frame que Drive tiene para el archivo y lo guarda en disco.
// Lo usan el endpoint (al mirar) y el precalentado tras un escaneo: comparten el
// singleflight y el tope de pedidos simultáneos, así no se duplica el trabajo ni se
// satura la cuota de la API. Un archivo sin frame en Drive se recuerda un rato.
func (h *Handler) fetchDriveThumbnail(hash, cacheFile, driveFileID string) ([]byte, error) {
	if driveThumbnailKnownMissing(hash, cacheFile) {
		return nil, drive.ErrNoThumbnail
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

		imgBytes, err := client.GetThumbnail(ctx, driveFileID, driveThumbWidth)
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
			driveThumbMissing.SetT(hash, true, driveThumbMissingTTL)
			if os.MkdirAll(filepath.Dir(cacheFile), 0755) == nil {
				_ = os.WriteFile(driveThumbnailMissingMarker(cacheFile), nil, 0644)
			}
		}
		return nil, err
	}
	return v.([]byte), nil
}

func driveThumbnailMissingMarker(cacheFile string) string {
	return strings.TrimSuffix(cacheFile, ".jpg") + ".none"
}

// driveThumbnailKnownMissing dice si ya se sabe (en memoria o por la marca en disco) que Drive
// no tiene frame para este archivo, sin volver a preguntarle.
func driveThumbnailKnownMissing(hash, cacheFile string) bool {
	if _, ok := driveThumbMissing.Get(hash); ok {
		return true
	}
	if info, err := os.Stat(driveThumbnailMissingMarker(cacheFile)); err == nil && time.Since(info.ModTime()) < driveThumbMissingDiskTTL {
		return true
	}
	return false
}
