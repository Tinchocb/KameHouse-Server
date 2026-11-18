package db

import (
	"errors"
	"testing"

	"kamehouse/internal/database/models"
)

func TestPublicIdentityRejectsConflictingFileAssociations(t *testing.T) {
	d := identityRegressionDB(t)
	rows := []models.LibraryMedia{{Type: "SHOW", TmdbID: 77}, {Type: "ANIME", TmdbID: 77, MyanimelistId: 77}}
	if err := d.Gorm().Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	files := []models.LocalFile{{Path: "show.mkv", MediaID: 77, LibraryMediaId: rows[0].ID}, {Path: "anime.mkv", MediaID: 77, LibraryMediaId: rows[1].ID}}
	if err := d.Gorm().Create(&files).Error; err != nil {
		t.Fatal(err)
	}
	for _, resolve := range []func(*Database, int) (*models.LibraryMedia, error){GetLibraryMediaByExternalMediaID, ResolveLibraryMediaByPublicID} {
		media, err := resolve(d, 77)
		var ambiguous *AmbiguousMediaIDError
		if media != nil || !errors.As(err, &ambiguous) || ambiguous.MediaID != 77 {
			t.Fatalf("ambiguous association accepted: %+v %v", media, err)
		}
	}
}

func TestPublicIdentityRejectsProviderCollisionWithoutFileAssociations(t *testing.T) {
	d := identityRegressionDB(t)
	rows := []models.LibraryMedia{{Type: "SHOW", TmdbID: 77}, {Type: "ANIME", TmdbID: 999, MyanimelistId: 77}}
	if err := d.Gorm().Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	media, err := ResolveLibraryMediaByPublicID(d, 77)
	var ambiguous *AmbiguousMediaIDError
	if media != nil || !errors.As(err, &ambiguous) {
		t.Fatalf("provider collision accepted: %+v %v", media, err)
	}
}

func TestPublicIdentityAllowsRepeatedAssociationToSameTitle(t *testing.T) {
	d := identityRegressionDB(t)
	media := &models.LibraryMedia{Type: "SHOW", TmdbID: 77}
	if err := d.Gorm().Create(media).Error; err != nil {
		t.Fatal(err)
	}
	files := []models.LocalFile{{Path: "episode1.mkv", MediaID: 77, LibraryMediaId: media.ID}, {Path: "episode2.mkv", MediaID: 77, LibraryMediaId: media.ID}}
	if err := d.Gorm().Create(&files).Error; err != nil {
		t.Fatal(err)
	}
	got, err := ResolveLibraryMediaByPublicID(d, 77)
	if err != nil || got == nil || got.ID != media.ID {
		t.Fatalf("same title rejected: %+v %v", got, err)
	}
}
