package metadata

import "testing"

func TestParseTMDBDate(t *testing.T) {
	ptr := func(n int) *int { return &n }
	cases := []struct {
		in         string
		y, m, d    *int
		wantAllNil bool
	}{
		{in: "1986-02-26", y: ptr(1986), m: ptr(2), d: ptr(26)},
		{in: "1986-02", y: ptr(1986), m: ptr(2)},
		{in: "1986", y: ptr(1986)},
		{in: "2024-09-05", y: ptr(2024), m: ptr(9), d: ptr(5)},
		{in: "", wantAllNil: true},
		{in: "abcd-ef-gh", wantAllNil: true},
		{in: "0000-00-00", wantAllNil: true},
		{in: "1986-13x-26", y: ptr(1986), d: ptr(26)}, // el mes ilegible se descarta, el resto se conserva
	}
	eq := func(a, b *int) bool {
		if a == nil || b == nil {
			return a == b
		}
		return *a == *b
	}
	for _, tc := range cases {
		got := parseTMDBDate(tc.in)
		if !eq(got.Year, tc.y) || !eq(got.Month, tc.m) || !eq(got.Day, tc.d) {
			t.Errorf("parseTMDBDate(%q) = %v/%v/%v", tc.in, deref(got.Year), deref(got.Month), deref(got.Day))
		}
		if tc.wantAllNil && (got.Year != nil || got.Month != nil || got.Day != nil) {
			t.Errorf("parseTMDBDate(%q) debería quedar vacío", tc.in)
		}
	}
}

func deref(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}
