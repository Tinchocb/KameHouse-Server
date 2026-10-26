package cassette

import (
	"strings"
	"testing"

	"kamehouse/internal/mediastream/videofile"
)

// Las URLs de segmento son iguales en todos los episodios y se sirven como inmutables:
// la versión del archivo en cada URL evita que el navegador mezcle el audio de dos episodios.
func TestLinkQueryIncludesFileVersion(t *testing.T) {
	a := &Session{hash: "aaaa"}
	b := &Session{hash: "bbbb"}
	if a.linkQuery("") == b.linkQuery("") {
		t.Fatalf("dos archivos distintos comparten la misma query: %q", a.linkQuery(""))
	}
	if got := a.linkQuery("tok"); got != "token=tok&v=aaaa" {
		t.Fatalf("linkQuery con token = %q", got)
	}
}

func TestPlaylistsCarryQueryOnEveryURL(t *testing.T) {
	lang := "ja"
	info := &videofile.MediaInfo{
		Video:  &videofile.Video{Codec: "h264", Width: 1920, Height: 1080},
		Audios: []videofile.Audio{{Index: 1, Language: &lang, Channels: 2}},
	}
	ladder := []QualityLadderEntry{{Quality: Source, Width: 1920, Height: 1080, OriginalCanTransmux: true}}
	m := GenerateMasterPlaylist(info, ladder, "v=abc")
	for _, want := range []string{"./source/index.m3u8?v=abc", `URI="./audio/1/index.m3u8?v=abc"`} {
		if !strings.Contains(m, want) {
			t.Fatalf("falta %q en la lista maestra:\n%s", want, m)
		}
	}

	ki := &KeyframeIndex{Keyframes: []float64{0, 4, 8}, IsDone: true}
	v := GenerateVariantPlaylist(ki, 10, "v=abc")
	if !strings.Contains(v, "segment-0.ts?v=abc") || !strings.Contains(v, "segment-2.ts?v=abc") {
		t.Fatalf("los segmentos no llevan la versión:\n%s", v)
	}
	if plain := GenerateVariantPlaylist(ki, 10, ""); strings.Contains(plain, "?") {
		t.Fatalf("sin query no debe haber '?':\n%s", plain)
	}
}
