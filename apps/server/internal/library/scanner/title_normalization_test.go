package scanner

import (
	"strings"
	"testing"
)

func TestNormalizeTitle(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		want       string
		wantSeason int
	}{
		{
			name:       "Dragon Ball Z basic",
			input:      "Dragon Ball Z",
			want:       "dragon ball z",
			wantSeason: -1,
		},
		{
			name:       "Dragon Ball with season",
			input:      "Dragon Ball Season 2",
			want:       "dragon ball",
			wantSeason: 2,
		},
		{
			name:       "Dragon Ball Super with season and part",
			input:      "Dragon Ball Super Season 3 Part 2",
			want:       "dragon ball super",
			wantSeason: 3,
		},
		{
			name:       "Dragon Ball Z with Roman numeral",
			input:      "Dragon Ball Z Part II",
			want:       "dragon ball z",
			wantSeason: 2,
		},
		{
			name:       "Special characters in DB movie",
			input:      "Dragon Ball Z: Battle of Gods",
			want:       "dragon ball z battle of gods",
			wantSeason: -1,
		},
		{
			name:       "Smart quotes",
			input:      "Dragon Ball: Goku's Traffic Safety",
			want:       "dragon ball gokus traffic safety",
			wantSeason: -1,
		},
		{
			name:       "The Animation suffix",
			input:      "Dragon Ball Z The Animation",
			want:       "dragon ball z",
			wantSeason: -1,
		},
		{
			name:       "Case sensitivity uppercase",
			input:      "DRAGON BALL GT",
			want:       "dragon ball gt",
			wantSeason: -1,
		},
		{
			name:       "With 'The'",
			input:      "The Legend of Shenron",
			want:       "legend of shenron",
			wantSeason: -1,
		},
		{
			name:       "With 'Episode'",
			input:      "Dragon Ball Z Episode 100",
			want:       "dragon ball z 100",
			wantSeason: -1,
		},
		{
			name:       "OAD/OVA",
			input:      "Dragon Ball Z OVA",
			want:       "dragon ball z ova",
			wantSeason: -1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeTitle(tt.input)
			gotNormalized := strings.Join(got.Tokens, " ")
			if gotNormalized != tt.want {
				t.Errorf("NormalizeTitle(%q).Tokens = %q, want %q", tt.input, gotNormalized, tt.want)
			}
			if tt.wantSeason != 0 && got.Season != tt.wantSeason {
				t.Errorf("NormalizeTitle(%q).Season = %d, want %d", tt.input, got.Season, tt.wantSeason)
			}
		})
	}
}
