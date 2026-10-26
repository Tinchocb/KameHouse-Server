package handlers

import (
	"testing"

	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/videofile"
)

func TestParseDrivePath(t *testing.T) {
	cases := []struct{ in, id, name string }{
		{"gdrive://abc123/Show/S01/ep01.mp4", "abc123", "ep01.mp4"},
		{"gdrive://abc123", "abc123", "stream.mkv"},
		{"gdrive://abc123/Show/", "abc123", "stream.mkv"},
		{"gdrive://", "", "stream.mkv"},
	}
	for _, c := range cases {
		id, name := parseDrivePath(c.in)
		if id != c.id || name != c.name {
			t.Errorf("parseDrivePath(%q) = (%q, %q), want (%q, %q)", c.in, id, name, c.id, c.name)
		}
	}
}

func TestPublicDriveContainerHidesInternalURL(t *testing.T) {
	mc := &mediastream.MediaContainer{
		Filepath:   "http://127.0.0.1:1/api/v1/drive/play?internal=SECRET",
		StreamType: mediastream.StreamTypeDirect,
		StreamURL:  "http://127.0.0.1:1/api/v1/drive/play?internal=SECRET",
		MediaInfo: &videofile.MediaInfo{
			Path:      "http://127.0.0.1:1/api/v1/drive/play?internal=SECRET",
			Subtitles: []videofile.Subtitle{{}},
			Fonts:     []string{"a.ttf"},
		},
	}
	out := publicDriveContainer(mc, "gdrive://id/x.mkv", "/api/v1/drive/play?fileId=id")

	if out.Filepath != "gdrive://id/x.mkv" || out.StreamURL != "/api/v1/drive/play?fileId=id" || out.MediaInfo.Path != "gdrive://id/x.mkv" {
		t.Fatalf("la URL interna se filtró: %+v", out)
	}
	if out.MediaInfo.Subtitles != nil || out.MediaInfo.Fonts != nil {
		t.Fatal("subtítulos y fuentes embebidos deben quitarse en Drive")
	}
	// El original no se muta.
	if mc.MediaInfo.Subtitles == nil || mc.StreamURL == out.StreamURL {
		t.Fatal("publicDriveContainer mutó el contenedor original")
	}
}
