package db

import (
	"encoding/json"
	"testing"

	"kamehouse/internal/database/models"
)

func libraryMediaJSONFields(m *models.LibraryMedia) []json.RawMessage {
	return []json.RawMessage{m.Synonyms, m.Genres, m.Tags, m.AudioTracks, m.SubtitleTracks}
}

func TestLibraryMediaCachedJSONOwnership(t *testing.T) {
	t.Run("tmdb", func(t *testing.T) {
		g := openBackendSafetyDB(t)
		if err := g.AutoMigrate(&models.LibraryMedia{}); err != nil {
			t.Fatal(err)
		}
		m := &models.LibraryMedia{TmdbID: 123, Type: "SHOW",
			Synonyms: json.RawMessage(`["original"]`), Genres: json.RawMessage(`["original"]`),
			Tags: json.RawMessage(`["original"]`), AudioTracks: json.RawMessage(`["original"]`),
			SubtitleTracks: json.RawMessage(`["original"]`)}
		if err := g.Create(m).Error; err != nil {
			t.Fatal(err)
		}
		d := &Database{gormdb: g}
		read := func() *models.LibraryMedia {
			t.Helper()
			got, err := GetLibraryMediaByTmdbIdAndType(d, m.TmdbID, m.Type)
			if err != nil || got == nil {
				t.Fatalf("read: %v, %v", got, err)
			}
			return got
		}
		// Mutate both a SQL-loaded return and a warm-cache return. Neither
		// caller may modify the snapshot or another outstanding reader.
		for _, phase := range []string{"cold", "warm"} {
			got := read()
			for i, field := range libraryMediaJSONFields(got) {
				if string(field) != `["original"]` {
					t.Fatalf("%s field %d was contaminated: %s", phase, i, field)
				}
			}
			other := read()
			for _, field := range libraryMediaJSONFields(got) {
				field[2] = 'X'
			}
			for i, field := range libraryMediaJSONFields(other) {
				if string(field) != `["original"]` {
					t.Fatalf("%s field %d shared with another caller: %s", phase, i, field)
				}
			}
		}
		for i, field := range libraryMediaJSONFields(read()) {
			if string(field) != `["original"]` {
				t.Fatalf("warm field %d changed: %s", i, field)
			}
		}
	})
}
