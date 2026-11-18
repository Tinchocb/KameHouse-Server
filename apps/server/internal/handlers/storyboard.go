package handlers

import (
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/storyboard"
	"kamehouse/internal/util"
	"kamehouse/internal/util/ffmpegutil"
)

// HandleGetStoryboard serves a temporal index or a persistent contact sheet.
//
// @summary Get timeline storyboard
// @route /api/v1/video-storyboard [GET]
func (h *Handler) HandleGetStoryboard(c echo.Context) error {
	c.Response().Header().Set("Cache-Control", "no-store")
	path := c.QueryParam("path")
	var file models.LocalFile
	// The browser cannot supply arbitrary URLs, ffmpeg inputs or filesystem paths.
	if path == "" || h.App.Database.Gorm().WithContext(c.Request().Context()).Where("path = ?", path).First(&file).Error != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Archivo no disponible")
	}
	size, modified := file.FileSize, file.FileModTime
	if strings.HasPrefix(path, "gdrive://") {
		if file.DriveFileID == "" || h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
			return echo.NewHTTPError(http.StatusNotFound)
		}
	} else {
		roots, err := h.App.Database.GetAllLibraryPathsFromSettings()
		if err != nil {
			return err
		}
		allowed := false
		for _, root := range roots {
			if isLexicallyUnder(root, path) && util.IsFileUnderDir(root, path) {
				allowed = true
				break
			}
		}
		if !allowed {
			return echo.NewHTTPError(http.StatusForbidden)
		}
		info, err := os.Stat(path)
		if err != nil || !info.Mode().IsRegular() {
			return echo.NewHTTPError(http.StatusNotFound)
		}
		size, modified = info.Size(), info.ModTime().UnixNano()
	}
	key := storyboard.Key(path, size, modified)
	if c.QueryParam("sheet") == "" {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"version": key, "interval": storyboard.Interval, "columns": storyboard.Columns,
			"rows": storyboard.Rows, "width": storyboard.Width, "height": storyboard.Height,
		})
	}
	sheet, err := strconv.Atoi(c.QueryParam("sheet"))
	if err != nil || sheet < 0 || sheet > storyboard.MaxSheet {
		return echo.NewHTTPError(http.StatusBadRequest, "Tramo inválido")
	}
	if c.QueryParam("v") != key {
		return echo.NewHTTPError(http.StatusConflict, "El archivo cambió")
	}
	var custom string
	if settings := h.App.MediastreamSettingsSnapshot(); settings != nil {
		custom = settings.FfmpegPath
	}
	input := path
	if strings.HasPrefix(path, "gdrive://") {
		input = h.driveInputURL(path)
		input += "&preview=1"
	}
	var data []byte
	etag := key + "-" + strconv.Itoa(sheet)
	if rawFrame := c.QueryParam("frame"); rawFrame != "" {
		frame, parseErr := strconv.Atoi(rawFrame)
		if parseErr != nil || frame < 0 || frame >= storyboard.Frames {
			return echo.NewHTTPError(http.StatusBadRequest, "Fotograma inválido")
		}
		etag += "-frame-" + strconv.Itoa(frame)
		data, err = storyboard.EnsureFrame(c.Request().Context(), h.App.Config.Cache.Dir, key, input, ffmpegutil.ResolveFFmpegPath(h.App.Config.Cache.Dir, custom), sheet*storyboard.Frames+frame)
	} else {
		data, err = storyboard.Ensure(c.Request().Context(), h.App.Config.Cache.Dir, key, input, ffmpegutil.ResolveFFmpegPath(h.App.Config.Cache.Dir, custom), sheet)
	}
	if err != nil {
		if errors.Is(err, storyboard.ErrBusy) {
			c.Response().Header().Set("Retry-After", "3")
			return echo.NewHTTPError(http.StatusServiceUnavailable, "Preparando vista previa")
		}
		return echo.NewHTTPError(http.StatusBadGateway, "No se pudo preparar la vista previa")
	}
	c.Response().Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	c.Response().Header().Set("ETag", `"`+etag+`"`)
	return c.Blob(http.StatusOK, "image/jpeg", data)
}
