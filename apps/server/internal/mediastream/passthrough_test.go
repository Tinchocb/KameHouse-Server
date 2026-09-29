package mediastream

import (
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/videofile"
	"strings"
	"testing"
)

func TestCanPassthroughVideo(t *testing.T) {
	hevc10 := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", PixFmt: "yuv420p10le"}}
	hevc8 := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", PixFmt: "yuv420p"}}
	av1 := &videofile.MediaInfo{Video: &videofile.Video{Codec: "av1"}}

	cases := []struct {
		name string
		info *videofile.MediaInfo
		caps *ClientCapabilities
		want bool
	}{
		{"sin caps", hevc8, nil, false},
		{"hevc 8-bit soportado", hevc8, &ClientCapabilities{Hevc: true}, true},
		{"hevc 10-bit sin soporte 10-bit", hevc10, &ClientCapabilities{Hevc: true}, false},
		{"hevc 10-bit soportado", hevc10, &ClientCapabilities{Hevc: true, Hevc10Bit: true}, true},
		{"cliente sin hevc", hevc8, &ClientCapabilities{}, false},
		{"av1 no va en MPEG-TS", av1, &ClientCapabilities{Av1: true}, false},
	}
	for _, c := range cases {
		if got := canPassthroughVideo(c.info, c.caps); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSourceMasterPlaylistCopiesVideo(t *testing.T) {
	mime := "hvc1.2.4.L153.B0"
	info := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", Width: 3840, Height: 2080, MimeCodec: &mime}}
	ladder := []cassette.QualityLadderEntry{{Quality: cassette.Source, Width: 3840, Height: 2080, OriginalCanTransmux: true}}
	m := cassette.GenerateMasterPlaylist(info, ladder, "")
	if !strings.Contains(m, `CODECS="hvc1.2.4.L153.B0,mp4a.40.2"`) || !strings.Contains(m, "./source/index.m3u8") {
		t.Fatalf("master inesperado:\n%s", m)
	}
	if q, err := cassette.QualityFromString("source"); err != nil || q != cassette.Source {
		t.Fatalf("QualityFromString(source) = %v, %v", q, err)
	}
}

func TestPickPreloadAudioPrefersBestLatino(t *testing.T) {
	s := func(v string) *string { return &v }
	audios := []videofile.Audio{
		{Index: 0, Language: s("ja"), Codec: "flac", Channels: 2, IsDefault: true},
		{Index: 1, Language: s("es"), Title: s("Latino TV"), Codec: "aac", Channels: 2},
		{Index: 2, Language: s("es"), Title: s("Latino"), Codec: "flac", Channels: 6},
		{Index: 3, Language: s("es"), Title: s("Castellano"), Codec: "flac", Channels: 8},
	}
	if got := pickPreloadAudio(audios, "spa-lat"); got != 2 {
		t.Fatalf("latino mejor calidad: got %d", got)
	}
	if got := pickPreloadAudio(audios[:2], "spa-lat"); got != 1 {
		t.Fatalf("latino baja calidad: got %d", got)
	}
	if got := pickPreloadAudio(audios, ""); got != 0 {
		t.Fatalf("sin preferencia → default: got %d", got)
	}
}
