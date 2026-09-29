package handlers

import "testing"

func TestParseSingleByteRange(t *testing.T) {
	cases := []struct {
		in               string
		start, end       int64
		hasRange, simple bool
	}{
		{"", 0, -1, false, true},
		{"bytes=0-", 0, -1, true, true},
		{"bytes=100-", 100, -1, true, true},
		{"bytes=5-99", 5, 99, true, true},
		{"bytes=-500", 0, 0, true, false},
		{"bytes=0-1,5-9", 0, 0, true, false},
		{"bytes=9-3", 0, 0, true, false},
		{"items=0-1", 0, 0, true, false},
	}
	for _, c := range cases {
		s, e, has, simple := parseSingleByteRange(c.in)
		if s != c.start || e != c.end || has != c.hasRange || simple != c.simple {
			t.Errorf("%q: got (%d,%d,%v,%v)", c.in, s, e, has, simple)
		}
	}
}
