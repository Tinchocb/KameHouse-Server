package strsim

import "testing"

func TestDiceMatchingSemantics(t *testing.T) {
	for _, tc := range []struct {
		a, b string
		want float64
	}{
		{"", "", 0}, {"same", "same", 1}, {"a", "cat", .85},
		{"a", "b", 0}, {"ab", "ac", 0}, {"aa", "aaaa", .5},
		{"日本語", "日本人", .5},
	} {
		if got := Dice(tc.a, tc.b); got != tc.want {
			t.Errorf("Dice(%q,%q)=%v want %v", tc.a, tc.b, got, tc.want)
		}
		if got := Dice(tc.b, tc.a); got != tc.want {
			t.Errorf("reverse Dice(%q,%q)=%v want %v", tc.b, tc.a, got, tc.want)
		}
	}
}
