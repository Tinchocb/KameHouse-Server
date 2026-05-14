package mediastream

import (
	"errors"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream/transcoder"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Transcode
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *Repository) ServeEchoTranscodeStream(c echo.Context, clientId string) error {

	if !r.IsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Module not initialized")
		return errors.New("module not initialized")
	}

	if !r.TranscoderIsInitialized() {
		r.wsEventManager.SendEvent(events.MediastreamShutdownStream, "Transcoder not initialized")
		return errors.New("transcoder not initialized")
	}

	path := c.Param("*")

	mediaContainer, found := r.playbackManager.clientMediaContainers.Get(clientId)
	if !found {
		mediaContainer, found = r.playbackManager.currentMediaContainer.Get()
		if !found {
			return errors.New("no file has been loaded")
		}
	}

	if path == "master.m3u8" {
		ret, err := r.transcoder.MustGet().GetMaster(mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, clientId)
		if err != nil {
			return err
		}

		return c.String(200, ret)
	}

	// Video stream
	// /:quality/index.m3u8
	if strings.HasSuffix(path, "index.m3u8") && !strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 2 {
			return errors.New("invalid index.m3u8 path")
		}

		quality, err := transcoder.QualityFromString(split[0])
		if err != nil {
			return err
		}

		ret, err := r.transcoder.MustGet().GetVideoIndex(mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, quality, clientId)
		if err != nil {
			return err
		}

		return c.String(200, ret)
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

		ret, err := r.transcoder.MustGet().GetAudioIndex(mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, int32(audioIndex), clientId)
		if err != nil {
			return err
		}

		return c.String(200, ret)
	}

	// Video segment
	// /:quality/segment-:segment.ts
	if strings.HasSuffix(path, ".ts") && !strings.Contains(path, "audio") {
		split := strings.Split(path, "/")
		if len(split) != 2 {
			return errors.New("invalid video segment path")
		}

		quality, err := transcoder.QualityFromString(split[0])
		if err != nil {
			return err
		}

		segment, err := transcoder.ParseSegment(split[1])
		if err != nil {
			return err
		}

		ret, err := r.transcoder.MustGet().GetVideoSegment(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, quality, segment, clientId)
		if err != nil {
			return err
		}

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

		segment, err := transcoder.ParseSegment(split[2])
		if err != nil {
			return err
		}

		ret, err := r.transcoder.MustGet().GetAudioSegment(c.Request().Context(), mediaContainer.Filepath, mediaContainer.Hash, mediaContainer.MediaInfo, int32(audioIndex), segment, clientId)
		if err != nil {
			return err
		}

		return c.File(ret)
	}

	return errors.New("invalid path")
}

// ShutdownTranscodeStream It should be called when unmounting the player (playback is no longer needed).
// This will also send an events.MediastreamShutdownStream event.
func (r *Repository) ShutdownTranscodeStream(clientId string) {
	r.reqMu.Lock()
	defer r.reqMu.Unlock()

	if !r.IsInitialized() {
		return
	}

	if !r.TranscoderIsInitialized() {
		return
	}

	r.logger.Warn().Str("client_id", clientId).Msg("mediastream: Received shutdown transcode stream request")

	r.playbackManager.clientMediaContainers.Delete(clientId)
	r.transcoder.MustGet().RemoveClient(clientId)

	// Send event
	r.wsEventManager.SendEvent(events.MediastreamShutdownStream, nil)
}
