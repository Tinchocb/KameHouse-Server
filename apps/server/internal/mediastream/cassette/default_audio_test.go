package cassette

import (
	"strings"
	"testing"

	"kamehouse/internal/mediastream/videofile"
)

func masterWithTwoAudios() string {
	es, ja := "es", "ja"
	latino, jp := "Latino", "Japonés"
	info := &videofile.MediaInfo{
		Video: &videofile.Video{Codec: "h264", Width: 1920, Height: 1080},
		Audios: []videofile.Audio{
			{Index: 0, Language: &es, Title: &latino, IsDefault: false, Channels: 2},
			{Index: 1, Language: &ja, Title: &jp, IsDefault: true, Channels: 2},
		},
	}
	ladder := []QualityLadderEntry{{Quality: Source, Width: 1920, Height: 1080, OriginalCanTransmux: true}}
	return GenerateMasterPlaylist(info, ladder, "v=abc")
}

// audioLine devuelve la línea #EXT-X-MEDIA de la pista `index`.
func audioLine(t *testing.T, master string, index string) string {
	t.Helper()
	for _, l := range strings.Split(master, "\n") {
		if strings.HasPrefix(l, "#EXT-X-MEDIA:TYPE=AUDIO") && strings.Contains(l, `URI="./audio/`+index+`/`) {
			return l
		}
	}
	t.Fatalf("no hay pista de audio %s en:\n%s", index, master)
	return ""
}

func TestPreferAudioTrackMovesDefault(t *testing.T) {
	master := masterWithTwoAudios()
	if !strings.Contains(audioLine(t, master, "1"), "DEFAULT=YES") {
		t.Fatalf("de partida el japonés debería ser el default:\n%s", master)
	}

	got := PreferAudioTrack(master, 0)

	if !strings.Contains(audioLine(t, got, "0"), "DEFAULT=YES,AUTOSELECT=YES,") {
		t.Fatalf("la pista 0 debería arrancar:\n%s", got)
	}
	if strings.Contains(audioLine(t, got, "1"), "DEFAULT=YES") {
		t.Fatalf("la pista 1 ya no debería ser default:\n%s", got)
	}
	if n := strings.Count(got, "DEFAULT=YES"); n != 1 {
		t.Fatalf("debe haber exactamente un DEFAULT=YES, hay %d:\n%s", n, got)
	}
	// El resto de la lista no cambia: mismas líneas, mismo orden.
	if strings.Count(got, "\n") != strings.Count(master, "\n") {
		t.Fatalf("cambió la cantidad de líneas:\n%s", got)
	}
	if !strings.Contains(got, `URI="./audio/0/index.m3u8?v=abc"`) {
		t.Fatalf("se perdió la versión en la URL de la pista:\n%s", got)
	}
}

func TestPreferAudioTrackUnknownIndexKeepsMaster(t *testing.T) {
	master := masterWithTwoAudios()
	for _, idx := range []int{2, 7, -1} {
		if got := PreferAudioTrack(master, idx); got != master {
			t.Fatalf("índice %d inexistente no debía tocar la lista:\n%s", idx, got)
		}
	}
}

func TestPreferAudioTrackDoesNotMatchIndexPrefix(t *testing.T) {
	// La pista 1 no debe confundirse con la 10 ni con la 12.
	master := strings.Join([]string{
		"#EXTM3U",
		`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="a",DEFAULT=YES,CHANNELS="2",URI="./audio/10/index.m3u8"`,
		`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="b",CHANNELS="2",URI="./audio/1/index.m3u8"`,
		"",
	}, "\n")
	got := PreferAudioTrack(master, 1)
	if strings.Contains(audioLine(t, got, "10"), "DEFAULT=YES") {
		t.Fatalf("la pista 10 no debía quedar default:\n%s", got)
	}
	if !strings.Contains(audioLine(t, got, "1"), "DEFAULT=YES") {
		t.Fatalf("la pista 1 debía quedar default:\n%s", got)
	}
}
