package streaming

import (
	"testing"
	"kamehouse/internal/mediastream/videofile"
)

func TestEvaluate_MKV_HEVC_Browser(t *testing.T) {
	// Mock a file that is MKV and HEVC
	container := "matroska,webm"
	info := &videofile.MediaInfo{
		Container: &container,
		Videos: []videofile.Video{
			{
				Codec: "hevc",
			},
		},
	}

	// Mock a Chrome browser
	chromeProfile := &ClientProfile{
		Name:            "Chrome Web",
		SupportedVideo:  []string{"h264"},
		SupportedAudio:  []string{"aac", "mp3"},
		SupportedFormat: []string{"mp4", "webm"},
	}

	decision := Evaluate(info, chromeProfile)

	if decision.Method != Transcode {
		t.Fatalf("Expected TRANSCODE for MKV/HEVC in browser, got %s. Reason: %s", decision.Method, decision.Reason)
	}

	t.Log("Successfully evaluated MKV/HEVC as TRANSCODE")
}

func TestEvaluate_MP4_H264_Browser(t *testing.T) {
	// Mock a file that is MP4 and H264
	container := "mov,mp4,m4a,3gp,3g2,mj2"
	info := &videofile.MediaInfo{
		Container: &container,
		Videos: []videofile.Video{
			{
				Codec: "h264",
			},
		},
	}

	chromeProfile := &ClientProfile{
		Name:            "Chrome Web",
		SupportedVideo:  []string{"h264"},
		SupportedAudio:  []string{"aac", "mp3"},
		SupportedFormat: []string{"mp4", "webm", "mov"}, // Just matching one
	}

	decision := Evaluate(info, chromeProfile)

	if decision.Method != DirectPlay {
		t.Fatalf("Expected DIRECT_PLAY for MP4/H264 in browser, got %s", decision.Method)
	}
	
	t.Log("Successfully evaluated MP4/H264 as DIRECT PLAY")
}
