package mediastream

import (
	"context"
	"errors"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream/cassette"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

// segmentFailureEvent elige el nivel del log de un segmento fallido. Cuando el cliente cancela
// (el reproductor cambia de calidad o se cierra) el pedido se corta a propósito: no es un fallo
// del servidor y no debe salir como ERR, o se confunde con los fallos reales de encoder.
func segmentFailureEvent(logger *zerolog.Logger, err error) *zerolog.Event {
	if errors.Is(err, context.Canceled) {
		return logger.Debug()
	}
	return logger.Error()
}

// segmentHTTPError maps a transcode segment error to an HTTP status. An
// out-of-range index is a 404 (clients legitimately probe near/past EOF); any
// other failure is a 500 that surfaces the real message instead of echo's
// generic "Internal Server Error", so the player can report an actionable cause.
func segmentHTTPError(err error) error {
	if errors.Is(err, cassette.ErrSegmentOutOfRange) {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}
	return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Transcode
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) ServeEchoTranscodeStream(c echo.Context, clientID string) error {

	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	// Solo original: un contenedor de transcode obtenido antes de activar el ajuste no debe
	// seguir codificando segmentos.
	if r.DirectPlayOnly() {
		return c.String(http.StatusConflict, "Solo original está activo: la transcodificación está deshabilitada.")
	}

	// Grab the engine once: it can be swapped by a settings change mid-request.
	tc, ok := r.getTranscoder()
	if !ok {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Transcoder not initialized")
		return errors.New("transcoder not initialized")
	}

	path := c.Param("*")

	mediaContainer, found := r.playbackManager.clientMediaContainers.Get(clientID)
	if !found {
		mediaContainer, found = r.playbackManager.getCurrentMediaContainer()
		if !found {
			return errors.New("no file has been loaded")
		}
	}

	if path == "master.m3u8" {
		ret, err := tc.GetMaster(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, clientID, "", mediaContainer.VideoPassthrough)
		if err != nil {
			r.logger.Error().Err(err).Str("path", mediaContainer.Filepath).Msg("mediastream: GetMaster failed")
			return err
		}

		// ?audio=N: el cliente pide arrancar con esa pista de audio (p. ej. el doblaje latino) en
		// vez de la que el archivo marca por defecto. Un valor inválido se ignora.
		if audioParam := c.QueryParam("audio"); audioParam != "" {
			if audioIdx, convErr := strconv.Atoi(audioParam); convErr == nil {
				ret = cassette.PreferAudioTrack(ret, audioIdx)
			}
		}

		c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		return c.Blob(200, "application/vnd.apple.mpegurl", []byte(withClientID(ret, clientID)))
	}

	// Video stream
	// /:quality/index.m3u8
	if strings.HasSuffix(path, "index.m3u8") && !strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 2 {
			return errors.New("invalid index.m3u8 path")
		}

		quality, err := cassette.QualityFromString(split[0])
		if err != nil {
			return err
		}

		ret, err := tc.GetVideoIndex(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, quality, clientID, "")
		if err != nil {
			r.logger.Error().Err(err).Str("path", mediaContainer.Filepath).Str("quality", split[0]).Msg("mediastream: GetVideoIndex failed")
			return err
		}

		c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		return c.Blob(200, "application/vnd.apple.mpegurl", []byte(withClientID(ret, clientID)))
	}

	// Audio stream
	// /audio/:audio/index.m3u8
	if strings.HasSuffix(path, "index.m3u8") && strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 3 {
			return errors.New("invalid audio index.m3u8 path")
		}

		audioIndex, err := strconv.ParseInt(split[1], 10, 32)
		if err != nil {
			return err
		}

		ret, err := tc.GetAudioIndex(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, int32(audioIndex), clientID, "")
		if err != nil {
			r.logger.Error().Err(err).Str("path", mediaContainer.Filepath).Str("audio", split[1]).Msg("mediastream: GetAudioIndex failed")
			return err
		}

		c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		return c.Blob(200, "application/vnd.apple.mpegurl", []byte(withClientID(ret, clientID)))
	}

	// Video segment
	// /:quality/segment-:segment.ts
	if strings.HasSuffix(path, ".ts") && !strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 2 {
			return errors.New("invalid video segment path")
		}

		quality, err := cassette.QualityFromString(split[0])
		if err != nil {
			return err
		}

		segment, err := cassette.ParseSegment(split[1])
		if err != nil {
			return err
		}

		ret, err := tc.GetVideoSegment(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, quality, segment, clientID)
		if err != nil {
			ev := segmentFailureEvent(r.logger, err)
			ev.Err(err).Str("path", mediaContainer.Filepath).Str("quality", split[0]).Int32("segment", segment).Msg("mediastream: GetVideoSegment failed")
			return segmentHTTPError(err)
		}

		c.Response().Header().Set("Content-Type", "video/mp2t")
		c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return c.File(ret)
	}

	// Audio segment
	// /audio/:audio/segment-:segment.ts
	if strings.HasSuffix(path, ".ts") && strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 3 {
			return errors.New("invalid audio segment path")
		}

		audioIndex, err := strconv.ParseInt(split[1], 10, 32)
		if err != nil {
			return err
		}

		segment, err := cassette.ParseSegment(split[2])
		if err != nil {
			return err
		}

		ret, err := tc.GetAudioSegment(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, int32(audioIndex), segment, clientID)
		if err != nil {
			ev := segmentFailureEvent(r.logger, err)
			ev.Err(err).Str("path", mediaContainer.Filepath).Str("audio", split[1]).Int32("segment", segment).Msg("mediastream: GetAudioSegment failed")
			return segmentHTTPError(err)
		}

		c.Response().Header().Set("Content-Type", "video/mp2t")
		c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return c.File(ret)
	}

	return errors.New("invalid path")
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Optimized
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ServeEchoOptimizedStream serves pre-transcoded static HLS stream files directly from cacheDir/optimized/<hash>.
func (r *Repository) ServeEchoOptimizedStream(c echo.Context, clientID string) error {
	if !r.IsInitialized() {
		return errors.New("module not initialized")
	}

	mediaContainer, found := r.playbackManager.clientMediaContainers.Get(clientID)
	if !found {
		mediaContainer, found = r.playbackManager.getCurrentMediaContainer()
		if !found {
			return errors.New("no file has been loaded")
		}
	}

	path := c.Param("*")
	if path == "" {
		return errors.New("invalid path")
	}

	targetDir := filepath.Join(r.PreTranscodeDir(), mediaContainer.Hash)
	absPath := filepath.Join(targetDir, path)

	// Ensure the path does not escape the target directory (path traversal check)
	rel, err := filepath.Rel(targetDir, absPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		return errors.New("invalid path (directory traversal)")
	}

	if strings.HasSuffix(absPath, ".m3u8") {
		// Las listas pre-transcodificadas son estáticas: sin el clientId en sus URI, los
		// segmentos caerían en el contenedor global igual que en el transcode en vivo.
		body, err := os.ReadFile(absPath)
		if err != nil {
			return err
		}
		c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		return c.Blob(http.StatusOK, "application/vnd.apple.mpegurl", []byte(withClientID(string(body), clientID)))
	} else if strings.HasSuffix(absPath, ".ts") {
		c.Response().Header().Set("Content-Type", "video/mp2t")
		// La URL del segmento es la misma en todos los episodios (el archivo se resuelve por
		// cliente), así que no puede ser inmutable: con "no-cache" el navegador revalida
		// (304 si es el mismo archivo) y no sirve el audio o video de otro episodio.
		c.Response().Header().Set("Cache-Control", "private, no-cache")
	}

	return c.File(absPath)
}

// ShutdownTranscodeStream It should be called when unmounting the player (playback is no longer needed).
// This will also send an events.MediastreamShutdownStream event.
func (r *Repository) ShutdownTranscodeStream(clientID string) {
	r.reqMu.Lock()
	defer r.reqMu.Unlock()

	if !r.IsInitialized() {
		return
	}

	tc, ok := r.getTranscoder()
	if !ok {
		return
	}

	// Cierre normal al salir del reproductor: no es una advertencia.
	r.logger.Info().Str("client_id", clientID).Msg("mediastream: Received shutdown transcode stream request")

	r.playbackManager.clientMediaContainers.Delete(clientID)
	tc.RemoveClient(clientID)

	// Send event only to the requesting client
	if clientID != "" {
		r.wsEventManager.SendEventTo(clientID, events.MediastreamShutdownStream, nil)
	} else {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, nil)
	}
}
