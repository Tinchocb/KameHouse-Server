package cassette

import (
	"strings"
	"testing"
)

// Caso real (Dragon Ball Z 1, en Drive): keyframes cada ~1,25 s, pero el video termina 30,6 s
// antes que el contenedor. El último segmento dura 30,6 s y con TARGETDURATION:4 el HLS
// nativo de Chromium rechazaba la lista entera.
func TestVariantPlaylistTargetCoversLongestSegment(t *testing.T) {
	ki := &KeyframeIndex{Keyframes: []float64{0, 1.251, 2.503}, IsDone: true}
	v := GenerateVariantPlaylist(ki, 33.106, "")
	if !strings.Contains(v, "#EXT-X-TARGETDURATION:31\n") {
		t.Fatalf("TARGETDURATION no cubre el último segmento (30,603 s):\n%s", v)
	}
	if !strings.Contains(v, "#EXTINF:30.603000\nsegment-2.ts\n#EXT-X-ENDLIST") {
		t.Fatalf("falta el último segmento o el cierre:\n%s", v)
	}
}

func TestVariantPlaylistTargetRoundsLikeTheSpec(t *testing.T) {
	cases := []struct {
		name      string
		keyframes []float64
		duration  float64
		want      string
	}{
		// Segmentos de hasta 4,49 s redondean a 4: la lista no cambia respecto del valor fijo de antes.
		{"segmentos cortos", []float64{0, 4.004, 8.008}, 12.4, "#EXT-X-TARGETDURATION:4\n"},
		{"GOP de 10,4 s", []float64{0, 10.427, 20.854}, 24, "#EXT-X-TARGETDURATION:10\n"},
		{"4,5 s redondea a 5", []float64{0, 4.5}, 8, "#EXT-X-TARGETDURATION:5\n"},
	}
	for _, c := range cases {
		ki := &KeyframeIndex{Keyframes: c.keyframes, IsDone: true}
		if v := GenerateVariantPlaylist(ki, c.duration, ""); !strings.Contains(v, c.want) {
			t.Errorf("%s: falta %q en:\n%s", c.name, c.want, v)
		}
	}
}

// Mientras se extraen los keyframes el último tramo todavía no existe: no cuenta para el
// TARGETDURATION ni se publica, y la lista queda abierta (sin ENDLIST).
func TestVariantPlaylistTargetIgnoresPendingTail(t *testing.T) {
	ki := &KeyframeIndex{Keyframes: []float64{0, 1.25, 2.5}, IsDone: false}
	v := GenerateVariantPlaylist(ki, 1479.551, "")
	if !strings.Contains(v, "#EXT-X-TARGETDURATION:4\n") {
		t.Fatalf("el tramo pendiente no debe agrandar el TARGETDURATION:\n%s", v)
	}
	if strings.Contains(v, "segment-2.ts") || strings.Contains(v, "#EXT-X-ENDLIST") {
		t.Fatalf("sin extracción completa no va el último segmento ni el cierre:\n%s", v)
	}
}
