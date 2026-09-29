package handlers

import (
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"
)

func TestEntryForResponseQuitaBaseAnimeSinTocarElOriginal(t *testing.T) {
	media := &models.LibraryMedia{}
	ep := &anime.Episode{BaseAnime: media, DisplayTitle: "Ep 1"}
	next := &anime.Episode{BaseAnime: media}
	orig := &anime.Entry{MediaID: 1, Media: media, Episodes: []*anime.Episode{ep, nil}, NextEpisode: next}

	out := entryForResponse(orig)

	if out.Media != media || out.MediaID != 1 {
		t.Fatal("la entrada debe conservar el media principal")
	}
	if out.Episodes[0].BaseAnime != nil || out.NextEpisode.BaseAnime != nil {
		t.Fatal("la respuesta no debe repetir baseAnime por episodio")
	}
	if out.Episodes[0].DisplayTitle != "Ep 1" || out.Episodes[1] != nil {
		t.Fatal("el resto de los datos del episodio debe mantenerse")
	}
	if ep.BaseAnime != media || next.BaseAnime != media || orig.Episodes[0] != ep {
		t.Fatal("la entrada original (posiblemente cacheada) no debe modificarse")
	}
	if entryForResponse(nil) != nil {
		t.Fatal("nil debe devolver nil")
	}
}
