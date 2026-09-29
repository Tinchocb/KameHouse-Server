package handlers

import (
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsLexicallyUnder(t *testing.T) {
	root := filepath.FromSlash("/media/series")
	if runtime.GOOS == "windows" {
		root = `D:\Media\Series`
	}
	cases := []struct {
		path string
		want bool
	}{
		{filepath.Join(root, "DB", "ep1.mkv"), true},
		{filepath.Join(root, "..", "secret.mkv"), false},
		{filepath.Join(root+"-other", "ep1.mkv"), false}, // prefijo textual, no subcarpeta
		{"ep1.mkv", false}, // relativa
	}
	if runtime.GOOS == "windows" {
		cases = append(cases,
			struct {
				path string
				want bool
			}{`\host\share\x.mkv`, false},
			struct {
				path string
				want bool
			}{`d:\media\series\DB\ep1.mkv`, true}, // Windows no distingue mayúsculas
		)
	}
	for _, tc := range cases {
		if got := isLexicallyUnder(root, tc.path); got != tc.want {
			t.Errorf("isLexicallyUnder(%q, %q) = %v, want %v", root, tc.path, got, tc.want)
		}
	}
}
