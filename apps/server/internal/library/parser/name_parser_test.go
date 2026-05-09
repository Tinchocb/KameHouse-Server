package parser

import (
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		filename string
		expected ParsedMedia
	}{
		{
			filename: "[Erai-raws] Jujutsu Kaisen - 01 [1080p][F9A5D6E3].mkv",
			expected: ParsedMedia{
				Title:        "Jujutsu Kaisen",
				Season:       1,
				Episode:      1,
				Resolution:   "1080P",
				ReleaseGroup: "Erai-raws",
			},
		},
		{
			filename: "[SubsPlease] Frieren 10-12 (720p) [A1B2C3D4].mp4",
			expected: ParsedMedia{
				Title:        "Frieren",
				Season:       1,
				Episode:      10,
				Resolution:   "720P",
				ReleaseGroup: "SubsPlease",
			},
		},
		{
			filename: "Dragon Ball Z 034.avi",
			expected: ParsedMedia{
				Title:        "Dragon Ball Z",
				Season:       1,
				Episode:      34,
				Resolution:   "UNKNOWN",
				ReleaseGroup: "",
			},
		},
		{
			filename: "Game.of.Thrones.S01E02.1080p.mkv",
			expected: ParsedMedia{
				Title:        "Game of Thrones",
				Season:       1,
				Episode:      2,
				Resolution:   "1080P",
				ReleaseGroup: "",
			},
		},
		{
			filename: "Dragon Ball Z - S07E243.mkv",
			expected: ParsedMedia{
				Title:        "Dragon Ball Z",
				Season:       7,
				Episode:      243,
				Resolution:   "UNKNOWN",
				ReleaseGroup: "",
			},
		},
		{
			filename: "[PuyaSubs!] One Piece - 1071 (1080p).mkv",
			expected: ParsedMedia{
				Title:        "One Piece",
				Season:       1,
				Episode:      1071,
				Resolution:   "1080P",
				ReleaseGroup: "PuyaSubs!",
			},
		},
		{
			filename: "Nueva Carpeta/[Erai-raws] Dragon Ball Daima - 01 (1080p).mkv",
			expected: ParsedMedia{
				Title:        "Dragon Ball Daima",
				Season:       1,
				Episode:      1,
				Resolution:   "1080P",
				ReleaseGroup: "Erai-raws",
			},
		},
		{
			filename: "[Erai-raws] Dragon Ball Daima - 01 (1080p HEVC x265).mkv",
			expected: ParsedMedia{
				Title:        "Dragon Ball Daima",
				Season:       1,
				Episode:      1,
				Resolution:   "1080P",
				ReleaseGroup: "Erai-raws",
			},
		},
		{
			filename: "Dragon.Ball.Daima.S01E01.1080p.WEB-DL.HEVC.x265.mkv",
			expected: ParsedMedia{
				Title:        "Dragon Ball Daima",
				Season:       1,
				Episode:      1,
				Resolution:   "1080P",
				ReleaseGroup: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			got := Parse(tt.filename)

			if got.Title != tt.expected.Title {
				t.Errorf("expected Title %q, got %q", tt.expected.Title, got.Title)
			}
			if got.Season != tt.expected.Season {
				t.Errorf("expected Season %d, got %d", tt.expected.Season, got.Season)
			}
			if got.Episode != tt.expected.Episode {
				t.Errorf("expected Episode %d, got %d", tt.expected.Episode, got.Episode)
			}
			if got.Resolution != tt.expected.Resolution {
				t.Errorf("expected Resolution %q, got %q", tt.expected.Resolution, got.Resolution)
			}
			if got.ReleaseGroup != tt.expected.ReleaseGroup {
				t.Errorf("expected ReleaseGroup %q, got %q", tt.expected.ReleaseGroup, got.ReleaseGroup)
			}
		})
	}
}
