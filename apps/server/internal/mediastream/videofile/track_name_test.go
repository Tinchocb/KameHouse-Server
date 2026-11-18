package videofile

import "testing"

func TestAudioRenditionName(t *testing.T) {
	for _, tc := range []struct{ title, want string }{
		{"", "Audio 3"}, {"  ", "Audio 3"}, {"und", "Audio 3"},
		{" UND-Latn ", "Audio 3"}, {"unknown", "Audio 3"},
		{"Signs & Songs", "Signs & Songs"}, {" Latino ", "Latino"},
		{"Comentario \"director\"\r\nStereo", "Comentario 'director'  Stereo"},
	} {
		t.Run(tc.title, func(t *testing.T) {
			if got := AudioRenditionName(tc.title, 2); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}
