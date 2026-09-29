package cassette

import (
	"kamehouse/internal/mediastream/videofile"
	"testing"
)

func TestBuildQualityLadderCapsHeavySources(t *testing.T) {
	// 4K HEVC a 40 Mbps: nunca encodear a 4K; arrancar en 1080p.
	info := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", Width: 3840, Height: 2160, Bitrate: 40_000_000}}
	ladder := BuildQualityLadder(info)
	if len(ladder) == 0 || ladder[0].Quality != P1080 {
		t.Fatalf("want 1080p first, got %+v", ladder)
	}
	for _, e := range ladder {
		if e.Height > MaxTranscodeHeight || e.Quality == Original {
			t.Fatalf("tier above cap: %+v", e)
		}
	}
	if StartQuality(info) != P1080 {
		t.Fatalf("start quality = %s", StartQuality(info))
	}
}

func TestBuildQualityLadderKeepsTransmux(t *testing.T) {
	info := &videofile.MediaInfo{Video: &videofile.Video{Codec: "h264", PixFmt: "yuv420p", Width: 3840, Height: 2160}}
	ladder := BuildQualityLadder(info)
	if len(ladder) != 1 || ladder[0].Quality != Original || !ladder[0].OriginalCanTransmux {
		t.Fatalf("want single transmux tier, got %+v", ladder)
	}
}

func TestBuildQualityLadderLowBitrateSourceKeepsNativeRes(t *testing.T) {
	// 1080p HEVC de bitrate bajo: el tier 1080p se descarta por bitrate, pero no
	// se debe caer a 720p — la resolución nativa va primero.
	info := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", Width: 1920, Height: 1080, Bitrate: 1_500_000}}
	ladder := BuildQualityLadder(info)
	if len(ladder) == 0 || ladder[0].Height != 1080 {
		t.Fatalf("want native 1080 first, got %+v", ladder)
	}
}
