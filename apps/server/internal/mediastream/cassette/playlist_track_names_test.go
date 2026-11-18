package cassette

import (
	"strings"
	"testing"

	"kamehouse/internal/mediastream/videofile"
)

func TestMasterPlaylistNamesUnnamedAudioByPosition(t *testing.T) {
	und, blank, placeholder, title := "und", "  ", "UND-Latn", `Comentario "director"`
	info := &videofile.MediaInfo{Audios: []videofile.Audio{
		{Index: 2, Language: &und},
		{Index: 7, Title: &blank},
		{Index: 8, Title: &placeholder, Language: &und},
		{Index: 9, Title: &title, Language: &und},
	}}
	got := GenerateMasterPlaylist(info, nil, "v=abc")
	for _, tc := range []struct{ index, name string }{
		{"2", "Audio 1"}, {"7", "Audio 2"}, {"8", "Audio 3"}, {"9", "Comentario 'director'"},
	} {
		line := audioLine(t, got, tc.index)
		if !strings.Contains(line, `NAME="`+tc.name+`"`) {
			t.Errorf("unexpected name in %s", line)
		}
	}
	if !strings.Contains(audioLine(t, got, "2"), `LANGUAGE="und"`) {
		t.Fatal("display names must not change language metadata")
	}
}
