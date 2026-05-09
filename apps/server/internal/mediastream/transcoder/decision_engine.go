package transcoder

import (
	"fmt"
	"kamehouse/internal/mediastream/videofile"
	"strings"
)

// PlaybackDecision encodes the optimal streaming strategy for a media file.
type PlaybackDecision struct {
	Method        PlaybackMethod
	Reason        string
	NeedsTransmux bool
	NeedsVideo    bool
	NeedsAudio    bool
	NeedsSubs     bool
	ShouldHls     bool
}

// DecisionEngine evaluates if the browser can natively play a given media file
// or if a transcode pipeline (HLS via FFmpeg) must be kicked off.
type DecisionEngine struct{}

func NewDecisionEngine() *DecisionEngine {
	return &DecisionEngine{}
}

// codecIsBrowsable returns true for codecs every modern browser supports natively in MP4.
func (de *DecisionEngine) codecIsBrowsable(codec string) bool {
	switch strings.ToLower(codec) {
	case "h264", "avc", "avc1":
		return true
	default:
		return false
	}
}

// containerIsBrowsable returns true if the container is natively playable.
func (de *DecisionEngine) containerIsBrowsable(container string) bool {
	switch strings.ToLower(container) {
	case "mp4", "webm", "ogg":
		return true
	default:
		return false
	}
}

// isHeavyMkv returns true for MKV files with high-bitrate or high-resolution video
// that would benefit from transcoding rather than raw streaming.
func (de *DecisionEngine) isHeavyMkv(info *videofile.MediaInfo) bool {
	if info.Container == nil || !strings.Contains(strings.ToLower(*info.Container), "matroska") {
		return false
	}
	if info.Video == nil {
		return false
	}
	return info.Video.Bitrate > 20_000_000 || info.Video.Height >= 2160
}

// hasAssSubtitles returns true if any subtitle track uses ASS/SSA.
func (de *DecisionEngine) hasAssSubtitles(info *videofile.MediaInfo) bool {
	for _, sub := range info.Subtitles {
		codec := strings.ToLower(sub.Codec)
		if codec == "ass" || codec == "ssa" {
			return true
		}
	}
	return false
}

// Decide evaluates media info and returns the optimal playback strategy.
func (de *DecisionEngine) Decide(info *videofile.MediaInfo) PlaybackDecision {
	if info == nil || info.Video == nil {
		return PlaybackDecision{
			Method:    Transcode,
			Reason:    "No media info available — defaulting to transcode",
			ShouldHls: true,
		}
	}

	container := ""
	if info.Container != nil {
		container = *info.Container
	}

	videoCodec := info.Video.Codec
	codecOk := de.codecIsBrowsable(videoCodec)
	containerOk := de.containerIsBrowsable(container)
	heavier := de.isHeavyMkv(info)
	hasAss := de.hasAssSubtitles(info)

	decision := PlaybackDecision{
		NeedsTransmux: !containerOk || heavier,
		NeedsVideo:    !codecOk,
		NeedsSubs:     hasAss,
	}

	switch {
	case !codecOk && !containerOk:
		decision.Method = Transcode
		decision.ShouldHls = true
		decision.Reason = fmt.Sprintf(
			"Codec %s and container %s not supported by browser — transcoding to H.264+AAC in MPEG-TS/HLS",
			videoCodec, container,
		)

	case !codecOk:
		decision.Method = Transcode
		decision.ShouldHls = true
		decision.Reason = fmt.Sprintf(
			"Codec %s not supported by browser — transcoding to H.264 via HLS",
			videoCodec,
		)

	case heavier:
		decision.Method = Transcode
		decision.ShouldHls = true
		decision.Reason = "Heavy MKV (high bitrate/resolution) — fragmenting via HLS transcode"

	case !containerOk:
		decision.Method = Transcode
		decision.ShouldHls = true
		decision.Reason = fmt.Sprintf(
			"Container %s not supported — transmuxing to MPEG-TS/HLS",
			container,
		)

	default:
		decision.Method = DirectStream
		decision.ShouldHls = false
		decision.Reason = "All codecs and container natively supported — direct streaming"
	}

	if hasAss {
		decision.Reason += " (ASS subtitles detected — requires Jassub on frontend)"
	}

	return decision
}
