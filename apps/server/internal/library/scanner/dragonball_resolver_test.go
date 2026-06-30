package scanner

import (
	"testing"
)

func TestResolveDragonBallID(t *testing.T) {
	tests := []struct {
		name        string
		title       string
		wantID      int
		wantMovie   bool
		wantFound   bool
	}{
		{
			name:        "Dragon Ball Kai",
			title:       "Dragon Ball Kai",
			wantID:      61709,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball Z Kai",
			title:       "Dragon Ball Z Kai",
			wantID:      61709,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "DBZ Kai",
			title:       "DBZ Kai",
			wantID:      61709,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball GT",
			title:       "Dragon Ball GT",
			wantID:      12697,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball Super",
			title:       "Dragon Ball Super",
			wantID:      62715,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball Daima",
			title:       "Dragon Ball Daima",
			wantID:      236994,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball Z",
			title:       "Dragon Ball Z",
			wantID:      12971,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball classic",
			title:       "Dragon Ball",
			wantID:      12609,
			wantMovie:   false,
			wantFound:   true,
		},
		{
			name:        "Dragon Ball Z Movie (with mapping match)",
			title:       "Dragon Ball Z La Batalla de los Dioses",
			wantID:      126963,
			wantMovie:   true,
			wantFound:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, isMovie, found := ResolveDragonBallID(tt.title)
			if found != tt.wantFound {
				t.Errorf("ResolveDragonBallID(%q) found = %t, want %t", tt.title, found, tt.wantFound)
			}
			if id != tt.wantID {
				t.Errorf("ResolveDragonBallID(%q) id = %d, want %d", tt.title, id, tt.wantID)
			}
			if isMovie != tt.wantMovie {
				t.Errorf("ResolveDragonBallID(%q) isMovie = %t, want %t", tt.title, isMovie, tt.wantMovie)
			}
		})
	}
}
