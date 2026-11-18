package handlers

import (
	"reflect"
	"testing"

	"kamehouse/internal/database/models"
)

// Las URLs esperadas son las mismas que fija el test del front
// (apps/web/src/lib/helpers/series-images.test.ts): la URL exacta es la clave
// de la caché del proxy local.
func TestShelfImageURLsCoincideConElFront(t *testing.T) {
	got := shelfImageURLs([]models.LibraryMedia{
		{Type: "SHOW", Format: "TV", PosterImage: "https://image.tmdb.org/t/p/original/p.jpg", BannerImage: "https://image.tmdb.org/t/p/w1280/b.jpg"},
		{Type: "MOVIE", Format: "MOVIE", PosterImage: "https://image.tmdb.org/t/p/original/m.jpg"},
		{Type: "SHOW", PosterImage: "/local/art.webp"},
	})
	want := []string{
		"https://image.tmdb.org/t/p/w342/p.jpg",
		"https://image.tmdb.org/t/p/w185/p.jpg",
		"https://image.tmdb.org/t/p/w342/b.jpg",
		"https://image.tmdb.org/t/p/w185/b.jpg",
		"https://image.tmdb.org/t/p/w342/m.jpg",
		"https://image.tmdb.org/t/p/w342/lMULbSFZNXUC87MqOZQ4SSV9DXI.jpg",
		"https://image.tmdb.org/t/p/w185/lMULbSFZNXUC87MqOZQ4SSV9DXI.jpg",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v\nwant %v", got, want)
	}
}

func TestShelfImageURLsSoloPeliculasSinDaima(t *testing.T) {
	got := shelfImageURLs([]models.LibraryMedia{
		{Type: "MOVIE", Format: "MOVIE", PosterImage: "https://image.tmdb.org/t/p/original/m.jpg"},
		{Type: "ANIME", Format: "OVA", PosterImage: "https://image.tmdb.org/t/p/original/ova.jpg"},
		{Type: "ANIME", Format: "SPECIAL", PosterImage: "https://image.tmdb.org/t/p/original/sp.jpg"},
	})
	want := []string{
		"https://image.tmdb.org/t/p/w342/m.jpg",
		"https://image.tmdb.org/t/p/w342/ova.jpg",
		"https://image.tmdb.org/t/p/w342/sp.jpg",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v\nwant %v", got, want)
	}
	if got := shelfImageURLs(nil); len(got) != 0 {
		t.Fatalf("sin biblioteca: got %v, want nada", got)
	}
}
