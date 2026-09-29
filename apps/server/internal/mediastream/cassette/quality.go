package cassette

import (
	"errors"
	"math"
	"strconv"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"
	"strings"
)

// Quality represents a named video resolution tier.
// [Original] indicates a transmux (copy) of the source video without re-encoding.
type Quality string

const (
	P240     Quality = "240p"
	P360     Quality = "360p"
	P480     Quality = "480p"
	P720     Quality = "720p"
	P1080    Quality = "1080p"
	P1440    Quality = "1440p"
	P4k      Quality = "4k"
	P8k      Quality = "8k"
	Original Quality = "original"
	// Source copies the video stream whatever its codec (e.g. HEVC). It's only
	// offered to clients that reported they can decode the source codec, so an
	// audio-track switch on a heavy file re-encodes just the audio.
	Source Quality = "source"
)

var Qualities = []Quality{P240, P360, P480, P720, P1080, P1440, P4k, P8k}

func QualityFromString(s string) (Quality, error) {
	if s == string(Original) {
		return Original, nil
	}
	if s == string(Source) {
		return Source, nil
	}
	for _, q := range Qualities {
		if string(q) == s {
			return q, nil
		}
	}
	return Original, errors.New("cassette: invalid quality string")
}

// Height returns the vertical resolution in pixels.
// For Original or unknown quality, returns 0.
func (q Quality) Height() uint32 {
	switch q {
	case P240:
		return 240
	case P360:
		return 360
	case P480:
		return 480
	case P720:
		return 720
	case P1080:
		return 1080
	case P1440:
		return 1440
	case P4k:
		return 2160
	case P8k:
		return 4320
	default:
		return 0
	}
}

// AverageBitrate returns the target average bitrate in bits/s for this tier.
// For Original or unknown quality, returns 0.
func (q Quality) AverageBitrate() uint32 {
	switch q {
	case P240:
		return 400_000
	case P360:
		return 800_000
	case P480:
		return 1_200_000
	case P720:
		return 2_400_000
	case P1080:
		return 4_800_000
	case P1440:
		return 9_600_000
	case P4k:
		return 16_000_000
	case P8k:
		return 28_000_000
	default:
		return 0
	}
}

// MaxBitrate returns the peak bitrate used for VBV/HRD in bits/s.
// For Original or unknown quality, returns 0.
func (q Quality) MaxBitrate() uint32 {
	switch q {
	case P240:
		return 700_000
	case P360:
		return 1_400_000
	case P480:
		return 2_100_000
	case P720:
		return 4_000_000
	case P1080:
		return 8_000_000
	case P1440:
		return 12_000_000
	case P4k:
		return 28_000_000
	case P8k:
		return 40_000_000
	default:
		return 0
	}
}

// dynamic quality ladder

// QualityLadderEntry is one rung in a dynamic quality ladder built from
// the source file's actual properties
type QualityLadderEntry struct {
	Quality Quality
	Width   int32
	Height  int32
	// Whether this quality tier requires transcoding (vs transmux/copy).
	NeedsTranscode bool
	// Whether the source's codec already matches the output codec so the
	// original tier can transmux (copy) the video stream.
	OriginalCanTransmux bool
}

// BuildQualityLadder generates a quality ladder for the source file.
//   - Never offers tiers above the source resolution (useless upscale)
//   - Marks the original tier as transmux-capable when the source is h264
//     at a compatible profile (avoids an entire re-encode)
//   - Computes actual output dimensions preserving aspect ratio
//   - Skips tiers whose bitrate would exceed the source's native bitrate (wasteful to transcode to a "lower quality" at higher bitrate)
func BuildQualityLadder(info *videofile.MediaInfo) []QualityLadderEntry {
	if info.Video == nil {
		return nil
	}

	srcHeight := info.Video.Height
	srcWidth := info.Video.Width
	srcBitrate := info.Video.Bitrate
	aspectRatio := float64(srcWidth) / float64(srcHeight)

	// whether the source can be transmuxed (copied) as the "original"
	// h264 baseline/main/high at standard levels is universally playable
	canTransmux := isTransmuxableVideo(info.Video)

	// Transmuxable source: the only tier is a stream copy (no encode at all).
	// No lower tiers, to prevent the player from requesting them in parallel
	// and locking the backend.
	if canTransmux {
		return []QualityLadderEntry{{
			Quality:             Original,
			Width:               int32(srcWidth),
			Height:              int32(srcHeight),
			OriginalCanTransmux: true,
		}}
	}

	// Source needs a real encode (HEVC, 10-bit, AV1…). Encoding at the source
	// resolution/bitrate of a heavy movie (4K HEVC at 40+ Mbps) can't keep up in
	// real time on most machines: the first segment took ages and playback
	// stalled (black screen after an audio switch). Cap encodes at 1080p and
	// list tiers highest-first so hls.js starts on the best tier that still
	// encodes in real time (hls.js starts on the first variant of the master).
	maxHeight := srcHeight
	if maxHeight > MaxTranscodeHeight {
		maxHeight = MaxTranscodeHeight
	}

	var ladder []QualityLadderEntry
	for i := len(Qualities) - 1; i >= 0; i-- {
		q := Qualities[i]
		h := q.Height()

		// skip tiers above source resolution (upscaling is pointless) or above the cap
		if h > maxHeight {
			continue
		}

		// skip tiers whose average bitrate exceeds the source bitrate
		// e.g. skip a 720p tier at 2.4 Mbps when the source is a low bitrate 1080p at 1.5 Mbps.
		// The top tier is always kept when the source is above the cap, so a heavy
		// file never drops below 1080p just because of a bitrate heuristic.
		topTier := len(ladder) == 0 && srcHeight > MaxTranscodeHeight
		if !topTier && srcBitrate > 0 && q.AverageBitrate() >= srcBitrate {
			continue
		}

		ladder = append(ladder, QualityLadderEntry{
			Quality:        q,
			Width:          util.ClosestEven(int32(float64(h) * aspectRatio)),
			Height:         int32(h),
			NeedsTranscode: true,
		})
	}

	// Source at or below the cap whose native resolution isn't covered by a tier
	// (low bitrate, or odd height like 800p): offer the source-resolution encode
	// first so quality doesn't drop to the next tier down.
	if srcHeight <= MaxTranscodeHeight && (len(ladder) == 0 || uint32(ladder[0].Height) < srcHeight) {
		ladder = append([]QualityLadderEntry{{
			Quality:        Original,
			Width:          int32(srcWidth),
			Height:         int32(srcHeight),
			NeedsTranscode: true,
		}}, ladder...)
	}

	return ladder
}

// MaxTranscodeHeight is the highest resolution the transcoder encodes to. Above
// it a live encode is rarely real-time, so heavy sources get downscaled.
const MaxTranscodeHeight = 1080

// StartQuality is the tier playback starts on (and the one worth pre-warming):
// the first entry of the ladder, i.e. the first variant of the master playlist.
func StartQuality(info *videofile.MediaInfo) Quality {
	ladder := BuildQualityLadder(info)
	if len(ladder) == 0 {
		return Original
	}
	return ladder[0].Quality
}

// isTransmuxableVideo returns true if the codec can be directly copied
// into an HLS mpegts container without re-encoding and be playable in browsers.
func isTransmuxableVideo(video *videofile.Video) bool {
	codec := strings.ToLower(video.Codec)

	// 10-bit and 12-bit videos (like High 10 Profile or HDR) are not widely supported
	// for direct play in standard browser players and will trigger decode errors.
	if strings.Contains(video.PixFmt, "10") || strings.Contains(video.PixFmt, "12") {
		return false
	}

	// Only H.264 is universally supported inside MPEG-TS HLS streams by browsers and HLS.js.
	// HEVC/H.265, VP9, and AV1 inside TS containers cause PIPELINE_ERROR_DECODE in many client players.
	return codec == "h264"
}

// audio codec awareness

// AudioTranscodeDecision describes how an audio track should be handled
type AudioTranscodeDecision struct {
	// Copy is true when the source codec is HLS-compatible and can be
	// transmitted without re-encoding.
	Copy bool
	// Codec is the output codec flag (e.g. "aac", "copy").
	Codec string
	// Bitrate is the output bitrate flag (e.g. "128k", "384k"). Empty when
	// Copy is true.
	Bitrate string
	// Channels is the output channel count as a string.
	Channels string
}

// DecideAudioTranscode determina cómo se debe tratar una pista de audio.
// Siempre re-codifica el audio a AAC para garantizar A/V sync mediante
// el filtro aresample=async=1. No se usa copy directo aunque la fuente sea
// AAC stereo, porque el remux a MPEG-TS sin resample causa deriva de sync
// (los PTS del audio copiado no se ajustan a las variaciones del encoder de video).
//   - ≤ 2 canales: AAC estéreo @ 128k
// DecideAudioTranscode determines how an audio track should be processed for HLS delivery.
func DecideAudioTranscode(audio *videofile.Audio) AudioTranscodeDecision {
	channels := 2
	bitrate := "192k"

	if audio.Channels == 1 {
		channels = 1
		bitrate = "96k"
	}

	return AudioTranscodeDecision{
		Copy:     false,
		Codec:    "aac",
		Bitrate:  bitrate,
		Channels: strconv.Itoa(channels),
	}
}

// EffectiveBitrate returns the bitrate to advertize in the master playlist
func EffectiveBitrate(q Quality, srcBitrate uint32) (avg uint32, peak uint32) {
	if q == Original {
		return srcBitrate, srcBitrate
	}
	avg = q.AverageBitrate()
	peak = q.MaxBitrate()
	if srcBitrate > 0 {
		avg = uint32(math.Min(float64(avg), float64(srcBitrate)*0.8))
		peak = uint32(math.Min(float64(peak), float64(srcBitrate)))
	}
	return avg, peak
}
