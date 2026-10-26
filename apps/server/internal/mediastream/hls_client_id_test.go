package mediastream

import (
	"strings"
	"testing"
)

// Regresión: sin el clientId en las URI, el índice y los segmentos de un cliente caían en el
// contenedor global y se servían archivos de otra reproducción.
func TestWithClientIDAddsParamToRelativeURIs(t *testing.T) {
	master := "#EXTM3U\n" +
		"#EXT-X-MEDIA:TYPE=AUDIO,URI=\"./audio/1/index.m3u8?v=h1\"\n" +
		"#EXT-X-STREAM-INF:BANDWIDTH=1\n" +
		"./source/index.m3u8?v=h1\n" +
		"#EXTINF:4.0,\n" +
		"https://cdn.example/otro.ts\n"

	got := withClientID(master, "abc 1")
	want := []string{
		`URI="./audio/1/index.m3u8?v=h1&clientId=abc+1"`,
		"./source/index.m3u8?v=h1&clientId=abc+1",
	}
	for _, w := range want {
		if !strings.Contains(got, w) {
			t.Fatalf("falta %q en:\n%s", w, got)
		}
	}
	if strings.Contains(got, "https://cdn.example/otro.ts?") || strings.Contains(got, "otro.ts&clientId") {
		t.Fatalf("una URL absoluta no debe tocarse:\n%s", got)
	}
}

func TestWithClientIDKeepsCRLFAndIsIdempotent(t *testing.T) {
	playlist := "#EXTM3U\r\n#EXTINF:4.0,\r\nsegment-1.ts?v=h1\r\n"

	once := withClientID(playlist, "x1")
	if !strings.Contains(once, "segment-1.ts?v=h1&clientId=x1\r\n") {
		t.Fatalf("CRLF o parámetro mal puesto:\n%q", once)
	}
	if twice := withClientID(once, "x1"); twice != once {
		t.Fatalf("aplicar dos veces cambió la lista:\n%q\n%q", once, twice)
	}
}

func TestWithClientIDWithoutIDLeavesPlaylistAlone(t *testing.T) {
	playlist := "#EXTM3U\nsegment-1.ts?v=h1\n"
	if got := withClientID(playlist, ""); got != playlist {
		t.Fatalf("sin clientId no debe cambiar nada: %q", got)
	}
}
