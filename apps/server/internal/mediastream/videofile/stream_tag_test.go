package videofile

import (
	"testing"

	"gopkg.in/vansante/go-ffprobe.v2"
)

// Los tags de ffprobe conservan la mayúscula del MKV: el nombre de una pista puede venir
// como "title", "TITLE" o "Title". streamTag debe encontrarlo en cualquiera.
func TestStreamTagIgnoresCase(t *testing.T) {
	cases := []struct {
		name string
		tags ffprobe.Tags
		want string
	}{
		{"minúsculas", ffprobe.Tags{"title": "Español Latino"}, "Español Latino"},
		{"mayúsculas", ffprobe.Tags{"TITLE": "Español Latino"}, "Español Latino"},
		{"mixto", ffprobe.Tags{"Title": "Español Latino"}, "Español Latino"},
		{"sin el tag", ffprobe.Tags{"language": "spa"}, ""},
		{"valor vacío", ffprobe.Tags{"TITLE": ""}, ""},
		{"valor no texto", ffprobe.Tags{"TITLE": 42.0}, ""},
		{"sin tags", nil, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stream := &ffprobe.Stream{TagList: tc.tags}
			if got := streamTag(stream, "title"); got != tc.want {
				t.Fatalf("streamTag(title) = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestStreamTagLanguageIgnoresCase(t *testing.T) {
	stream := &ffprobe.Stream{TagList: ffprobe.Tags{"LANGUAGE": "spa"}}
	if got := streamTag(stream, "language"); got != "spa" {
		t.Fatalf("streamTag(language) = %q, want %q", got, "spa")
	}
}
