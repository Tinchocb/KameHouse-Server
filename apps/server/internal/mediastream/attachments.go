package mediastream

import (
	"context"
	"encoding/json"
	"errors"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream/videofile"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

func (r *Repository) ServeEchoExtractedSubtitles(c echo.Context) error {
	// Subtítulos externos (.srt/.ass junto al video): no pasan por la extracción ffmpeg.
	if idx, ok := externalSubtitleIndex(c); ok {
		return r.serveExternalSubtitle(c, idx)
	}

	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	// Subtítulos embebidos de un archivo de Drive: se leen por ventanas de tiempo en
	// vez de bajar el archivo entero.
	if p := c.QueryParam("path"); strings.HasPrefix(p, "gdrive://") && r.DriveSubtitleStatus(p).State != DriveSubtitlesDone {
		if handled, err := r.serveDriveWindowSubtitle(c, p); handled {
			return err
		}
	}

	mediaHash, err := r.subtitleMediaHash(c)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 90*time.Second)
	defer cancel()
	if err := r.playbackManager.WaitForExtraction(ctx, mediaHash); err != nil {
		c.Response().Header().Set("Retry-After", "5")
		return echo.NewHTTPError(503, "subtitle extraction in progress")
	}

	cacheDir := videofile.GetFileSubsCacheDir(r.cacheDir, mediaHash)
	if cacheDir == "" {
		return echo.NewHTTPError(404, "could not find subtitles")
	}

	trackIndex := c.QueryParam("trackIndex")
	if trackIndex == "" {
		return echo.NewHTTPError(400, "trackIndex query parameter is required")
	}
	trackIdx, err := strconv.Atoi(trackIndex)
	if err != nil || trackIdx < 0 {
		return echo.NewHTTPError(400, "invalid trackIndex parameter: must be a non-negative integer")
	}
	trackIndexStr := strconv.Itoa(trackIdx)

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return echo.NewHTTPError(404, "could not read subtitles directory")
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), trackIndexStr+".") {
			r.logger.Trace().Msgf("mediastream: Serving subtitle %s", entry.Name())
			return c.File(filepath.Join(cacheDir, entry.Name()))
		}
	}

	return echo.NewHTTPError(404, "subtitle file not found")
}

func (r *Repository) ServeEchoParsedPGS(c echo.Context) error {
	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	mediaHash, err := r.subtitleMediaHash(c)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Request().Context(), 90*time.Second)
	defer cancel()
	if err := r.playbackManager.WaitForExtraction(ctx, mediaHash); err != nil {
		c.Response().Header().Set("Retry-After", "5")
		return echo.NewHTTPError(503, "subtitle extraction in progress")
	}

	cacheDir := videofile.GetFileSubsCacheDir(r.cacheDir, mediaHash)
	if cacheDir == "" {
		return echo.NewHTTPError(404, "could not find subtitles")
	}

	trackIndex := c.QueryParam("trackIndex")
	if trackIndex == "" {
		return echo.NewHTTPError(400, "trackIndex query parameter is required")
	}
	trackIdx, err := strconv.Atoi(trackIndex)
	if err != nil || trackIdx < 0 {
		return echo.NewHTTPError(400, "invalid trackIndex parameter: must be a non-negative integer")
	}
	trackIndexStr := strconv.Itoa(trackIdx)

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return echo.NewHTTPError(404, "could not read subtitles directory")
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), trackIndexStr+".sup") {
			jsonCachePath := filepath.Join(cacheDir, trackIndexStr+".pgs.json")
			if _, statErr := os.Stat(jsonCachePath); statErr == nil {
				return c.File(jsonCachePath)
			}

			r.logger.Trace().Msgf("mediastream: Parsing PGS subtitle %s", entry.Name())
			events, err := ParseSupFile(filepath.Join(cacheDir, entry.Name()))
			if err != nil {
				r.logger.Error().Err(err).Msg("mediastream: Failed to parse PGS subtitle")
				return err
			}

			if jsonData, err := json.Marshal(events); err == nil {
				_ = os.WriteFile(jsonCachePath, jsonData, 0644)
				return c.Blob(http.StatusOK, "application/json", jsonData)
			}
			return c.JSON(200, events)
		}
	}

	return echo.NewHTTPError(404, "subtitle file not found")
}

func (r *Repository) ServeEchoExtractedAttachments(c echo.Context) error {
	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return echo.NewHTTPError(http.StatusServiceUnavailable, "module not initialized")
	}

	// Serving an extracted font/attachment does not use the transcoder, so we don't
	// require it to be initialized (fonts must load in pure direct play too).

	// Get the parameter group
	subFilePath := c.Param("*")

	mediaHash, err := r.subtitleMediaHash(c)
	if err != nil {
		return err
	}

	// Fonts are written by the same extraction job as subtitles; wait for it so the
	// first play of a cold file doesn't 404 the fonts before ffmpeg has written them.
	ctx, cancel := context.WithTimeout(c.Request().Context(), 90*time.Second)
	defer cancel()
	if err := r.playbackManager.WaitForExtraction(ctx, mediaHash); err != nil {
		c.Response().Header().Set("Retry-After", "5")
		return echo.NewHTTPError(http.StatusServiceUnavailable, "attachment extraction in progress")
	}

	retPath := videofile.GetFileAttCacheDir(r.cacheDir, mediaHash)

	if retPath == "" {
		return echo.NewHTTPError(http.StatusNotFound, "could not find attachments")
	}

	subFilePath, _ = url.PathUnescape(subFilePath)
	targetPath := filepath.Clean(filepath.Join(retPath, subFilePath))
	cleanRetPath := filepath.Clean(retPath)
	rel, err := filepath.Rel(cleanRetPath, targetPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid path")
	}

	return c.File(targetPath)
}
