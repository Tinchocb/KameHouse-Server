package comparison

import (
	"testing"
)

func TestExtractSeasonNumber(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected int
	}{
		{
			name:     "Contains 'season' followed by a number",
			input:    "JJK season 2",
			expected: 2,
		},
		{
			name:     "Ordinal",
			input:    "Spy x Family 2nd Season",
			expected: 2,
		},
		{
			name:     "Roman numberal ignored",
			input:    "Spy X Family",
			expected: -1,
		},
		{
			name:     "Roman Numerals",
			input:    "Overlord III",
			expected: 3,
		},
		{
			name:     "Does not contain season",
			input:    "This is a test",
			expected: -1,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := ExtractSeasonNumber(test.input)
			if result != test.expected {
				t.Errorf("ExtractSeasonNumber() with args %v, expected %v, but got %v.", test.input, test.expected, result)
			}
		})
	}
}

func TestValueContainsSpecial(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Contains 'OVA' in uppercase",
			input:    "JJK OVA",
			expected: true,
		},
		{
			name:     "Contains 'ova' in lowercase",
			input:    "JJK ova",
			expected: false,
		},
		{
			name:     "Does not contain special keywords",
			input:    "This is a test",
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := ValueContainsSpecial(test.input)
			if result != test.expected {
				t.Errorf("ValueContainsSpecial() with args %v, expected %v, but got %v.", test.input, test.expected, result)
			}
		})
	}
}

func TestValueContainsIgnoredKeywords(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "Contains 'EXTRAS' in uppercase",
			input:    "EXTRAS",
			expected: true,
		},
		{
			name:     "Contains 'extras' in lowercase",
			input:    "extras",
			expected: true,
		},
		{
			name:     "Does not contain ignored keywords",
			input:    "This is a test",
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := ValueContainsIgnoredKeywords(test.input)
			if result != test.expected {
				t.Errorf("ValueContainsIgnoredKeywords() with args %v, expected %v, but got %v.", test.input, test.expected, result)
			}
		})
	}
}

func TestValueContainsNC(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{
			input:    "NCOP",
			expected: true,
		},
		{
			input:    "ncop",
			expected: true,
		},
		{
			input:    "One Piece - 1000 - NCOP",
			expected: true,
		},
		{
			input:    "One Piece ED 2",
			expected: true,
		},
		{
			input:    "This is a test",
			expected: false,
		}, {
			input:    "This is a test",
			expected: false,
		},
		{
			input:    "Himouto.Umaru.chan.S01E02.1080p.BluRay.Opus2.0.x265-smol",
			expected: false,
		},
		{
			input:    "Himouto.Umaru.chan.S01E02.1080p.BluRay.x265-smol",
			expected: false,
		},
		{
			input:    "One Piece - 1000 - Operation something something",
			expected: false,
		},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			result := ValueContainsNC(test.input)
			if result != test.expected {
				t.Errorf("ValueContainsNC() with args %v, expected %v, but got %v.", test.input, test.expected, result)
			}
		})
	}
}

//func TestLikelyNC(t *testing.T) {
//	tests := []struct {
//		name     string
//		input    string
//		expected bool
//	}{
//		{
//			name:     "Does not contain NC keywords 1",
//			input:    "Himouto.Umaru.chan.S01E02.1080p.BluRay.Opus2.0.x265-smol",
//			expected: false,
//		},
//		{
//			name:     "Does not contain NC keywords 2",
//			input:    "Himouto.Umaru.chan.S01E02.1080p.BluRay.x265-smol",
//			expected: false,
//		},
//		{
//			name:     "Contains NC keywords 1",
//			input:    "Himouto.Umaru.chan.S00E02.1080p.BluRay.x265-smol",
//			expected: true,
//		},
//		{
//			name:     "Contains NC keywords 2",
//			input:    "Himouto.Umaru.chan.OP02.1080p.BluRay.x265-smol",
//			expected: true,
//		},
//	}
//
//	for _, test := range tests {
//		t.Run(test.name, func(t *testing.T) {
//			metadata := habari.Parse(test.input)
//			var episode string
//			var season string
//
//			if len(metadata.SeasonNumber) > 0 {
//				if len(metadata.SeasonNumber) == 1 {
//					season = metadata.SeasonNumber[0]
//				}
//			}
//
//			if len(metadata.EpisodeNumber) > 0 {
//				if len(metadata.EpisodeNumber) == 1 {
//					episode = metadata.EpisodeNumber[0]
//				}
//			}
//
//			result := LikelyNC(test.input, season, episode)
//			if result != test.expected {
//				t.Errorf("ValueContainsNC() with args %v, expected %v, but got %v.", test.input, test.expected, result)
//			}
//		})
//	}
//}
