package streaming

import (
	"strings"

	"kamehouse/internal/mediastream/videofile"
)

// ClientProfile declares what a given client can natively play.
type ClientProfile struct {
	Name            string
	SupportedVideo  []string
	SupportedAudio  []string
	SupportedFormat []string
}

type DecisionMethod string

const (
	DirectPlay DecisionMethod = "DIRECT_PLAY"
	Transcode  DecisionMethod = "TRANSCODE"
)

// Decision is a pure data struct — decoupled from transport/HTTP layer.
type Decision struct {
	Method DecisionMethod
	Reason string
}

// EvaluatePlayback performs O(N) codec/container comparison against the client profile.
// N is bounded by the small slice sizes (codecs per file ≈ 2–4), making this effectively O(1).
func EvaluatePlayback(mediaInfo *videofile.MediaInfo, client ClientProfile) Decision {
	if mediaInfo == nil {
		return Decision{Method: Transcode, Reason: "Missing media info"}
	}

	// Rule 1: Container check — AVI and MKV are not natively playable in browsers.
	if mediaInfo.Container != nil {
		formats := strings.Split(*mediaInfo.Container, ",")
		for _, f := range formats {
			f = strings.TrimSpace(f)
			if f == "matroska" || f == "webm" || f == "avi" {
				if !hasFormat(client.SupportedFormat, f) {
					return Decision{Method: Transcode, Reason: "Container (" + f + ") not supported by ClientProfile"}
				}
			}
		}
	}

	// Rule 2: Video codec check — HEVC and AV1 require explicit client support.
	for _, video := range mediaInfo.Videos {
		codec := strings.ToLower(video.Codec)
		if codec == "hevc" || codec == "h265" || codec == "av1" {
			if !hasCodec(client.SupportedVideo, codec) {
				return Decision{Method: Transcode, Reason: "Codec (" + codec + ") not supported by ClientProfile"}
			}
		}
	}

	return Decision{Method: DirectPlay, Reason: "Direct Play eligible"}
}

func hasFormat(supported []string, format string) bool {
	for _, s := range supported {
		if s == format || s == "mkv" && format == "matroska" {
			return true
		}
	}
	return false
}

func hasCodec(supported []string, codec string) bool {
	for _, s := range supported {
		if s == codec || (s == "h265" && codec == "hevc") || (s == "hevc" && codec == "h265") {
			return true
		}
	}
	return false
}

// Evaluate is a backward-compatible alias used by existing tests and handlers.
func Evaluate(mediaInfo *videofile.MediaInfo, client *ClientProfile) Decision {
	if client == nil {
		return Decision{Method: Transcode, Reason: "Missing client profile"}
	}
	return EvaluatePlayback(mediaInfo, *client)
}
