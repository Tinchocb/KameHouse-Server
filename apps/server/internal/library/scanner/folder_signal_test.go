package scanner

import (
	"path/filepath"
	"testing"
)

func TestMeaningfulImmediateFolderTitle(t *testing.T) {
	tests := []struct {
		name     string
		folder   string
		expected string
	}{
		{name: "generic Spanish folder", folder: "Nueva Carpeta", expected: ""},
		{name: "random hex folder", folder: "A1B2C3D4E5F6", expected: ""},
		{name: "real title", folder: "Dragon Ball Daima", expected: "Dragon Ball Daima"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join("library", tt.folder, "[Erai-raws] Dragon Ball Daima - 01.mkv")
			got := meaningfulImmediateFolderTitle(path)
			if got != tt.expected {
				t.Fatalf("expected %q, got %q", tt.expected, got)
			}
		})
	}
}
