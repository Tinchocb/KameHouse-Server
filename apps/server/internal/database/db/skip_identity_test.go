package db

import (
	"github.com/stretchr/testify/require"
	"kamehouse/internal/constants"
	"kamehouse/internal/database/models"
	"testing"
)

func TestResolvePublicMediaIDByMAL(t *testing.T) {
	for _, tc := range []struct {
		name, kind   string
		tmdb, public int
		explicit     bool
	}{
		{"show", "SHOW", 123, 123, false},
		{"movie", "MOVIE", 123, constants.MovieIDOffset + 123, false},
		{"jikan", "ANIME", 456, 456, false},
		{"mal-only", "ANIME", 0, 456, false},
		{"local-association", "SHOW", 0, 789, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := identityRegressionDB(t)
			m := models.LibraryMedia{Type: tc.kind, TmdbID: tc.tmdb, MyanimelistId: 456}
			require.NoError(t, d.Gorm().Create(&m).Error)
			if tc.explicit {
				require.NoError(t, d.Gorm().Create(&models.LocalFile{Path: "local.mkv", MediaID: tc.public, LibraryMediaId: m.ID}).Error)
			}
			id, err := ResolvePublicMediaIDByMAL(d, 456)
			require.NoError(t, err)
			require.Equal(t, tc.public, id)
		})
	}
}

func TestResolvePublicMediaIDByMALRejectsCollidingAssociations(t *testing.T) {
	d := identityRegressionDB(t)
	a := models.LibraryMedia{Type: "SHOW", TmdbID: 123, MyanimelistId: 456}
	b := models.LibraryMedia{Type: "SHOW", TmdbID: 789}
	require.NoError(t, d.Gorm().Create(&a).Error)
	require.NoError(t, d.Gorm().Create(&b).Error)
	files := []models.LocalFile{{Path: "a.mkv", MediaID: 123, LibraryMediaId: a.ID}, {Path: "b.mkv", MediaID: 123, LibraryMediaId: b.ID}}
	require.NoError(t, d.Gorm().Create(&files).Error)
	_, err := ResolvePublicMediaIDByMAL(d, 456)
	var ambiguous *AmbiguousMediaIDError
	require.ErrorAs(t, err, &ambiguous)
}
