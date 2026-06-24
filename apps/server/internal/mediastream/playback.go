package mediastream

import (
	"context"
	"errors"
	"fmt"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/result"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

const (
	StreamTypeTranscode StreamType = "transcode" // On-the-fly transcoding
	StreamTypeOptimized StreamType = "optimized" // Pre-transcoded
	StreamTypeDirect    StreamType = "direct"    // Direct streaming
)

type (
	StreamType string

	PlaybackManager struct {
		logger                *zerolog.Logger
		currentMediaContainer mo.Option[*MediaContainer] // The current media being played.
		repository            *Repository
		mediaContainers       *result.Map[string, *MediaContainer] // Temporary cache for the media containers.
		clientMediaContainers *result.Map[string, *MediaContainer]
	}

	PlaybackState struct {
		MediaID int `json:"mediaId"` // The media ID
	}

	MediaContainer struct {
		Filepath   string               `json:"filePath"`
		Hash       string               `json:"hash"`
		StreamType StreamType           `json:"streamType"` // Tells the frontend how to play the media.
		StreamURL  string               `json:"streamUrl"`  // The relative endpoint to stream the media.
		MediaInfo  *videofile.MediaInfo `json:"mediaInfo"`
		//Metadata  *Metadata       `json:"metadata"`
		// todo: add more fields (e.g. metadata)
	}
)

func NewPlaybackManager(repository *Repository) *PlaybackManager {
	return &PlaybackManager{
		logger:                repository.logger,
		repository:            repository,
		mediaContainers:       result.NewMap[string, *MediaContainer](),
		clientMediaContainers: result.NewMap[string, *MediaContainer](),
	}
}

func (p *PlaybackManager) KillPlayback() {
	p.logger.Debug().Msg("mediastream: Killing playback")
	if p.currentMediaContainer.IsPresent() {
		p.currentMediaContainer = mo.None[*MediaContainer]()
		p.logger.Trace().Msg("mediastream: Removed current media container")
	}
}

// RequestPlayback is called by the frontend to stream a media file
func (p *PlaybackManager) RequestPlayback(filepath string, streamType StreamType, clientID string) (ret *MediaContainer, err error) {

	p.logger.Debug().Str("filepath", filepath).Any("type", streamType).Msg("mediastream: Requesting playback")

	// Create a new media container
	ret, err = p.newMediaContainer(filepath, streamType)

	if err != nil {
		p.logger.Error().Err(err).Msg("mediastream: Failed to create media container")
		return nil, fmt.Errorf("failed to create media container: %v", err)
	}

	// Set the current media container.
	p.currentMediaContainer = mo.Some(ret)
	if clientID != "" {
		p.clientMediaContainers.Set(clientID, ret)
	}
	p.clientMediaContainers.Set("1", ret)

	p.logger.Info().Str("filepath", filepath).Msg("mediastream: Ready to play media")

	return
}

// PreloadPlayback is called by the frontend to preload a media container so that the data is stored in advanced
func (p *PlaybackManager) PreloadPlayback(filepath string, streamType StreamType) (ret *MediaContainer, err error) {

	p.logger.Debug().Str("filepath", filepath).Any("type", streamType).Msg("mediastream: Preloading playback")

	// Create a new media container
	ret, err = p.newMediaContainer(filepath, streamType)

	if err != nil {
		p.logger.Error().Err(err).Msg("mediastream: Failed to create media container")
		return nil, fmt.Errorf("failed to create media container: %v", err)
	}

	// Zero Latency Next: Pre-transcode and cache the first N segments (video and audio) of the next episode in the background.
	if ret.StreamType == StreamTypeTranscode && p.repository.transcoder.IsPresent() {
		go func() {
			tc, _ := p.repository.transcoder.Get()
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()

			preloadSegments := 3
			if p.repository.settings.IsPresent() {
				s := p.repository.settings.MustGet()
				if s != nil && s.TranscodeThreads > 0 {
					preloadSegments = s.TranscodeThreads
				}
			}

			p.logger.Debug().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Msg("mediastream: Pre-transcoding video segments for zero-latency start")
			for i := 0; i < preloadSegments; i++ {
				_, _ = tc.GetVideoSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, "original", int32(i), "preload-client")
			}

			if len(ret.MediaInfo.Audios) > 0 {
				defaultAudioIdx := int32(0)
				for _, aud := range ret.MediaInfo.Audios {
					if aud.IsDefault {
						defaultAudioIdx = int32(aud.Index)
						break
					}
				}
				p.logger.Debug().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Msg("mediastream: Pre-transcoding audio segments for zero-latency start")
				for i := 0; i < preloadSegments; i++ {
					_, _ = tc.GetAudioSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, defaultAudioIdx, int32(i), "preload-client")
				}
			}
			p.logger.Info().Str("filepath", ret.Filepath).Int("segments", preloadSegments).Msg("mediastream: Finished proactive pre-transcoding of segments")
		}()
	}

	p.logger.Info().Str("filepath", filepath).Msg("mediastream: Ready to play media")

	return
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Optimize
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (p *PlaybackManager) newMediaContainer(filePath string, streamType StreamType) (ret *MediaContainer, err error) {
	p.logger.Debug().Str("filepath", filePath).Any("type", streamType).Msg("mediastream: New media container requested")
	// Get the hash of the file.
	hash, err := videofile.GetHashFromPath(filePath)
	if err != nil {
		return nil, err
	}

	p.logger.Trace().Str("hash", hash).Msg("mediastream: Checking cache")

	// Check the cache ONLY if the stream type is the same.
	if mc, ok := p.mediaContainers.Get(hash); ok && mc.StreamType == streamType {
		p.logger.Debug().Str("hash", hash).Msg("mediastream: Media container cache HIT")
		return mc, nil
	}

	p.logger.Trace().Str("hash", hash).Msg("mediastream: Creating media container")

	// Get the media information of the file.
	ret = &MediaContainer{
		Filepath:   filePath,
		Hash:       hash,
		StreamType: streamType,
	}

	p.logger.Debug().Msg("mediastream: Extracting media info")

	ret.MediaInfo, err = p.repository.mediaInfoExtractor.GetInfo(p.repository.settings.MustGet().FfprobePath, filePath)
	if err != nil {
		return nil, err
	}

	p.logger.Debug().Msg("mediastream: Extracted media info, extracting attachments")

	// Extract the attachments from the file.
	err = videofile.ExtractAttachment(p.repository.settings.MustGet().FfmpegPath, filePath, hash, ret.MediaInfo, p.repository.cacheDir, p.logger)
	if err != nil {
		p.logger.Error().Err(err).Msg("mediastream: Failed to extract attachments")
		return nil, err
	}

	p.logger.Debug().Msg("mediastream: Extracted attachments")

	// Dynamic fallback from Direct Play to Transcode if the browser doesn't support the container/codecs natively.
	if streamType == StreamTypeDirect {
		isDirectPlayable := false
		ext := strings.ToLower(ret.MediaInfo.Extension)
		// Universal direct-playable containers in modern browsers (including mkv inside WebView2)
		if ext == "mp4" || ext == "m4v" || ext == "webm" || ext == "mov" || ext == "ogg" || ext == "mkv" {
			hasSupportedVideo := false
			if ret.MediaInfo.Video != nil {
				vCodec := strings.ToLower(ret.MediaInfo.Video.Codec)
				// h264, hevc/h265, vp8, vp9, and av1 are natively supported.
				if vCodec == "h264" || vCodec == "hevc" || vCodec == "h265" || vCodec == "vp8" || vCodec == "vp9" || vCodec == "av1" {
					hasSupportedVideo = true
				}
			} else {
				// Audio only
				hasSupportedVideo = true
			}

			hasSupportedAudio := true
			if len(ret.MediaInfo.Audios) > 0 {
				aCodec := strings.ToLower(ret.MediaInfo.Audios[0].Codec)
				// aac, mp3, opus, flac, vorbis, ac3, and dts (dca) are universally supported or handled by modern audio hardware.
				if aCodec != "aac" && aCodec != "mp3" && aCodec != "opus" && aCodec != "flac" && aCodec != "vorbis" && aCodec != "ac3" && aCodec != "dca" {
					hasSupportedAudio = false
				}
			}

			if hasSupportedVideo && hasSupportedAudio {
				isDirectPlayable = true
			}
		}

		if !isDirectPlayable {
			p.logger.Info().Str("filepath", filePath).Str("ext", ext).Msg("mediastream: File container or codecs not natively supported by browser. Falling back to Transcode HLS.")
			streamType = StreamTypeTranscode
			ret.StreamType = StreamTypeTranscode
		}
	}

	streamURL := ""
	switch streamType {
	case StreamTypeDirect:
		// Directly serve the file.
		streamURL = "/api/v1/mediastream/direct/play"
	case StreamTypeTranscode:
		// Live transcode the file.
		streamURL = "/api/v1/mediastream/transcode/master.m3u8"
	case StreamTypeOptimized:
		optimizedPath := filepath.Join(p.repository.cacheDir, "optimized", hash, "master.m3u8")
		if _, err := os.Stat(optimizedPath); err == nil {
			streamURL = "/api/v1/mediastream/hls/master.m3u8"
		} else {
			// Fall back gracefully to transcode stream
			ret.StreamType = StreamTypeTranscode
			streamURL = "/api/v1/mediastream/transcode/master.m3u8"
		}
	}

	// TODO: Add metadata to the media container.
	// ...

	if streamURL == "" {
		return nil, errors.New("invalid stream type")
	}

	// Set the stream URL.
	ret.StreamURL = streamURL

	// Store the media container in the map.
	p.mediaContainers.Set(hash, ret)

	return
}
