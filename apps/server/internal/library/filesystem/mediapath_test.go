package filesystem

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSeparateFilePathS(t *testing.T) {
	tests := []struct {
		path              string
		potentialPrefixes []string
		expected          *SeparatedFilePath
	}{
		{
			path:              "/path/to/file.mkv",
			potentialPrefixes: []string{"/path/to", "/path"},
			expected:          &SeparatedFilePath{Filename: "file.mkv", Dirnames: []string{}},
		},
		{
			path:              "/path/TO/to/file.mkv",
			potentialPrefixes: []string{"/path"},
			expected:          &SeparatedFilePath{Filename: "file.mkv", Dirnames: []string{"TO", "to"}},
		},
		{
			path:              "/path/to/file2.mkv",
			potentialPrefixes: []string{},
			expected:          &SeparatedFilePath{Filename: "file2.mkv", Dirnames: []string{"path", "to"}},
		},
		{
			path:              "/mnt/Anime/Bungou Stray Dogs/Bungou Stray Dogs 5th Season/[SubsPlease] Bungou Stray Dogs - 61 (1080p) [F609B947].mkv",
			potentialPrefixes: []string{"/mnt/Anime", "/mnt/Anime/", "/mnt", "/var/"},
			expected:          &SeparatedFilePath{Filename: "[SubsPlease] Bungou Stray Dogs - 61 (1080p) [F609B947].mkv", Dirnames: []string{"Bungou Stray Dogs", "Bungou Stray Dogs 5th Season"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			fmt.Println("Here")
			res := SeparateFilePathS(tt.path, tt.potentialPrefixes)
			assert.Equal(t, tt.expected.Filename, res.Filename)
			assert.Equal(t, tt.expected.Dirnames, res.Dirnames)
		})
	}
}

