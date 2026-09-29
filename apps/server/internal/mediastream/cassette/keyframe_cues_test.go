package cassette

import (
	"reflect"
	"testing"

	"kamehouse/internal/matroska"
)

func TestKeyframesFromCues(t *testing.T) {
	cues := []*matroska.Cue{
		{Time: 0, Track: 1},
		{Time: 1_001_000_000, Track: 1},
		{Time: 500_000_000, Track: 9}, // subtítulo: no es keyframe de video
		{Time: 1_001_000_000, Track: 1},
		nil,
		{Time: 8_300_000_000, Track: 1},
		{Time: 4_000_000_000, Track: 10},
	}

	got := keyframesFromCues(cues, map[uint8]bool{1: true})
	want := []float64{0, 1.001, 8.3}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("solo video: got %v, want %v", got, want)
	}

	// Sin info de pistas: se usan todos, ordenados y sin repetir.
	got = keyframesFromCues(cues, nil)
	want = []float64{0, 0.5, 1.001, 4, 8.3}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("sin pistas: got %v, want %v", got, want)
	}
}
