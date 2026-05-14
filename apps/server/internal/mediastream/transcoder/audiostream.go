package transcoder

import (
	"fmt"
	"path/filepath"

	"github.com/rs/zerolog"
)

type AudioStream struct {
	Stream
	index    int32
	logger   *zerolog.Logger
	settings *Settings
}

// NewAudioStream creates a new AudioStream for a file, at a given audio index.
func NewAudioStream(file *FileStream, idx int32, logger *zerolog.Logger, settings *Settings) *AudioStream {
	logger.Trace().Str("file", filepath.Base(file.Path)).Int32("idx", idx).Msgf("trancoder: Creating audio stream")
	ret := new(AudioStream)
	ret.index = idx
	ret.logger = logger
	ret.settings = settings
	NewStream(fmt.Sprintf("audio %d", idx), file, ret, &ret.Stream, settings, logger)
	return ret
}

func (as *AudioStream) getOutPath(encoderId int) string {
	return filepath.Join(as.file.Out, fmt.Sprintf("segment-a%d-%d-%%d.ts", as.index, encoderId))
}

func (as *AudioStream) getFlags() Flags {
	return AudioF
}

func (as *AudioStream) getTranscodeArgs(segments string) []string {
	channels := "2"
	bitrate := "128k"

	if as.file != nil && as.file.Info != nil {
		for _, audio := range as.file.Info.Audios {
			if audio.Index == uint32(as.index) {
				if audio.Channels >= 6 {
					channels = "2" // Downmix to stereo
					bitrate = "256k" // Higher bitrate for downmixed 5.1
				} else if audio.Channels > 2 {
					channels = "2"
					bitrate = "192k"
				} else if audio.Channels == 2 {
					channels = "2"
					bitrate = "192k"
				}
				break
			}
		}
	}

	return []string{
		"-map", fmt.Sprintf("0:a:%d", as.index),
		"-c:a", "aac",
		"-ac", channels,
		"-b:a", bitrate,
	}
}
