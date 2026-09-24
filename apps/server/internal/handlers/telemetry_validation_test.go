package handlers

import "testing"

func TestValidPlaybackBeat(t *testing.T) {
	cases := []struct {
		name          string
		mediaID       int
		episodeNumber int
		currentTime   float64
		duration      float64
		want          bool
	}{
		{"valid full beat", 123, 5, 100.0, 1400.0, true},
		{"movie episode zero allowed", 123, 0, 10.0, 5400.0, true},
		{"zero duration allowed (unknown length)", 123, 5, 10.0, 0, true},
		{"empty beat dropped (nothing loaded)", 123, 5, 0, 0, false},
		{"zero mediaId dropped", 0, 5, 100.0, 1400.0, false},
		{"negative mediaId dropped", -1, 5, 100.0, 1400.0, false},
		{"negative episode dropped", 123, -1, 100.0, 1400.0, false},
		{"negative currentTime dropped", 123, 5, -1.0, 1400.0, false},
		{"negative duration dropped", 123, 5, 100.0, -5.0, false},
		{"currentTime beyond duration dropped", 123, 5, 1500.0, 1400.0, false},
		{"currentTime equal duration kept", 123, 5, 1400.0, 1400.0, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := validPlaybackBeat(tc.mediaID, tc.episodeNumber, tc.currentTime, tc.duration); got != tc.want {
				t.Errorf("validPlaybackBeat(%d, %d, %v, %v) = %v, want %v",
					tc.mediaID, tc.episodeNumber, tc.currentTime, tc.duration, got, tc.want)
			}
		})
	}
}
