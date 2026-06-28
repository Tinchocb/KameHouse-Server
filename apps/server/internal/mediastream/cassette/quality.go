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
)

var Qualities = []Quality{P240, P360, P480, P720, P1080, P1440, P4k, P8k}

func QualityFromString(s string) (Quality, error) {
	if s == string(Original) {
		return Original, nil
	}
	for _, q := range Qualities {
		if string(q) == s {
			return q, nil
		}
	}
	return Original, errors.New("cassette: invalid quality string")
}

// QualityFromHeight returns the smallest quality tier whose height is >= given value
func QualityFromHeight(height uint32) Quality {
	for _, q := range Qualities {
		if q.Height() >= height {
			return q
		}
	}
	return P240
}

// Height returns the vertical resolution in pixels
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
	case Original:
		panic("cassette: Original quality must be handled specially")
	}
	panic("cassette: invalid quality value")
}

// AverageBitrate returns the target average bitrate in bits/s for this tier
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
	case Original:
		panic("cassette: Original quality must be handled specially")
	}
	panic("cassette: invalid quality value")
}

// MaxBitrate returns the peak bitrate used for VBV/HRD in bits/s
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
	case Original:
		panic("cassette: Original quality must be handled specially")
	}
	panic("cassette: invalid quality value")
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

	var ladder []QualityLadderEntry

	// include the "original" tier first
	ladder = append(ladder, QualityLadderEntry{
		Quality:             Original,
		Width:               int32(srcWidth),
		Height:              int32(srcHeight),
		NeedsTranscode:      !canTransmux,
		OriginalCanTransmux: canTransmux,
	})

	// If the video can be transmuxed directly (copy), do not offer lower transcoded qualities
	// to prevent the player from requesting them in parallel and locking the backend.
	if canTransmux {
		return ladder
	}

	// add downscale tiers that make sense
	for _, q := range Qualities {
		h := q.Height()

		// skip tiers above source resolution, upscaling is pointless
		if h > srcHeight {
			continue
		}

		// skip tiers whose average bitrate exceeds the source bitrate
		// e.g. skip a 720p tier at 2.4 Mbps when the source is a low bitrate 1080p at 1.5 Mbps
		if srcBitrate > 0 && q.AverageBitrate() >= srcBitrate {
			continue
		}

		w := util.ClosestEven(int32(float64(h) * aspectRatio))

		ladder = append(ladder, QualityLadderEntry{
			Quality:        q,
			Width:          w,
			Height:         int32(h),
			NeedsTranscode: true,
		})
	}

	return ladder
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
//   - > 2 canales: AAC multicanal @ 384k con aresample=async=1 para A/V sync.
func DecideAudioTranscode(audio *videofile.Audio) AudioTranscodeDecision {
	channels := 2
	bitrate := "128k"

	if audio.Channels > 2 {
		channels = int(audio.Channels)
		bitrate = "384k"
	} else if audio.Channels > 0 {
		channels = int(audio.Channels)
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
