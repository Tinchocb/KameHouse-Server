package mediastream

import (
	"errors"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream/videofile"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

func (r *Repository) ServeEchoExtractedSubtitles(c echo.Context) error {

	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	if !r.TranscoderIsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Transcoder not initialized")
		return errors.New("transcoder not initialized")
	}

	// Get current media
	mediaContainer, found := r.playbackManager.currentMediaContainer.Get()
	if !found {
		return errors.New("no file has been loaded")
	}

	cacheDir := videofile.GetFileSubsCacheDir(r.cacheDir, mediaContainer.Hash)
	if cacheDir == "" {
		return errors.New("could not find subtitles")
	}

	trackIndex := c.QueryParam("trackIndex")
	if trackIndex == "" {
		return errors.New("trackIndex query parameter is required")
	}

	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return errors.New("could not read subtitles directory")
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), trackIndex+".") {
			r.logger.Trace().Msgf("mediastream: Serving subtitle %s", entry.Name())
			return c.File(filepath.Join(cacheDir, entry.Name()))
		}
	}

	return errors.New("subtitle file not found")
}

func (r *Repository) ServeEchoExtractedAttachments(c echo.Context) error {
	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	if !r.TranscoderIsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Transcoder not initialized")
		return errors.New("transcoder not initialized")
	}

	// Get the parameter group
	subFilePath := c.Param("*")

	// Get current media
	mediaContainer, found := r.playbackManager.currentMediaContainer.Get()
	if !found {
		return errors.New("no file has been loaded")
	}

	retPath := videofile.GetFileAttCacheDir(r.cacheDir, mediaContainer.Hash)

	if retPath == "" {
		return errors.New("could not find subtitles")
	}

	subFilePath, _ = url.PathUnescape(subFilePath)

	return c.File(filepath.Join(retPath, subFilePath))
}
