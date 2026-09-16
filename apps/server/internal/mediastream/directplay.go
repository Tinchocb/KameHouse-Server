package mediastream

import (
	"errors"
	"fmt"
	"kamehouse/internal/events"
	"kamehouse/internal/util"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Direct
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func resolveVideoContentType(ext string) string {
	switch strings.ToLower(ext) {
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".ogg", ".ogv":
		return "video/ogg"
	case ".mov":
		return "video/quicktime"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".wmv":
		return "video/x-ms-wmv"
	case ".flv":
		return "video/x-flv"
	case ".ts", ".mts", ".m2ts":
		return "video/mp2t"
	default:
		return "video/mp4"
	}
}

func sanitizeHeaderFilename(filename string) string {
	safe := strings.ReplaceAll(filename, "\"", "\\\"")
	safe = strings.ReplaceAll(safe, "\r", "")
	safe = strings.ReplaceAll(safe, "\n", "")
	return safe
}

func (r *Repository) ServeEchoFile(c echo.Context, rawFilePath string, clientID string, libraryPaths []string) error {
	// Unescape the file path, ignore errors
	filePath, _ := url.PathUnescape(rawFilePath)

	// If the file path is base64 encoded, decode it
	if util.IsBase64(rawFilePath) {
		var err error
		filePath, err = util.Base64DecodeStr(rawFilePath)
		if err != nil {
			// this shouldn't happen, but just in case IsBase64 is wrong
			filePath, _ = url.PathUnescape(rawFilePath)
		}
	}

	// Make sure the file is in the library directories
	inLibrary := false
	for _, libraryPath := range libraryPaths {
		if util.IsFileUnderDir(libraryPath, filePath) {
			inLibrary = true
			break
		}
	}

	if !inLibrary {
		return c.NoContent(http.StatusNotFound)
	}

	r.logger.Trace().Str("filepath", filePath).Str("payload", rawFilePath).Msg("mediastream: Served file")
	ext := strings.ToLower(filepath.Ext(filePath))
	c.Response().Header().Set("Content-Type", resolveVideoContentType(ext))
	c.Response().Header().Set("Accept-Ranges", "bytes")
	filename := sanitizeHeaderFilename(filepath.Base(filePath))
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))

	return c.File(filePath)
}

func (r *Repository) ServeEchoDirectPlay(c echo.Context, clientID string) error {

	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	// Get current media
	mediaContainer, found := r.playbackManager.clientMediaContainers.Get(clientID)
	if !found {
		mediaContainer, found = r.playbackManager.getCurrentMediaContainer()
		if !found {
			r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "no file has been loaded")
			return errors.New("no file has been loaded")
		}
	}

	ext := strings.ToLower(filepath.Ext(mediaContainer.Filepath))
	contentType := resolveVideoContentType(ext)

	if c.Request().Method == http.MethodHead {
		r.logger.Trace().Msg("mediastream: Received HEAD request for direct play")

		// Get the file size
		fileInfo, err := os.Stat(mediaContainer.Filepath)
		if err != nil {
			r.logger.Error().Msg("mediastream: Failed to get file info")
			return c.NoContent(http.StatusInternalServerError)
		}

		c.Response().Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
		c.Response().Header().Set("Content-Type", contentType)
		c.Response().Header().Set("Accept-Ranges", "bytes")
		filename := sanitizeHeaderFilename(filepath.Base(mediaContainer.Filepath))
		c.Response().Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
		return c.NoContent(http.StatusOK)
	}

	c.Response().Header().Set("Content-Type", contentType)
	c.Response().Header().Set("Accept-Ranges", "bytes")
	filename := sanitizeHeaderFilename(filepath.Base(mediaContainer.Filepath))
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	return c.File(mediaContainer.Filepath)
}
