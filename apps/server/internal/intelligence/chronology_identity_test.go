package intelligence

import (
	"context"
	"testing"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util"

	"github.com/stretchr/testify/require"
)

func TestChronologyDoesNotMixPublicIDsPrimaryKeysOrMovies(t *testing.T) {
	database, err := db.NewDatabase(context.Background(), t.TempDir(), "identity", util.NewLogger())
	require.NoError(t, err)
	defer database.Close()
	require.Eventually(t, func() bool { done, err := database.MigrationStatus(); return done && err == nil }, 5*time.Second, time.Millisecond)
	z := &models.LibraryMedia{BaseModel: models.BaseModel{ID: 12697}, Type: "SHOW", TmdbID: 12971}
	movie := &models.LibraryMedia{Type: "MOVIE", TmdbID: 12971}
	require.NoError(t, database.Gorm().Create(z).Error)
	require.NoError(t, database.Gorm().Create(movie).Error)
	require.NoError(t, database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: movie.ID, Status: "COMPLETED", Progress: 1}).Error)
	require.NoError(t, database.Gorm().Create(&models.WatchHistory{AccountID: 1, MediaID: 12697, EpisodeNumber: 7, CurrentTime: 100, Duration: 100}).Error)
	progress, err := BuildChronologyProgress(database, 1)
	require.NoError(t, err)
	for _, series := range progress.Series {
		if series.TmdbID == 12697 {
			require.Equal(t, []int{7}, series.WatchedEpisodes)
		}
		if series.TmdbID == 12971 {
			require.Empty(t, series.WatchedEpisodes)
			require.False(t, series.Completed)
		}
	}
}

func TestChronologyDoesNotInterpretAnotherShowsPublicIDAsLegacyPrimaryKey(t *testing.T) {
	database, err := db.NewDatabase(context.Background(), t.TempDir(), "legacy", util.NewLogger())
	require.NoError(t, err)
	defer database.Close()
	require.Eventually(t, func() bool { done, err := database.MigrationStatus(); return done && err == nil }, 5*time.Second, time.Millisecond)
	z := &models.LibraryMedia{BaseModel: models.BaseModel{ID: 1}, Type: "SHOW", TmdbID: 12971}
	require.NoError(t, database.Gorm().Create(z).Error)
	require.NoError(t, database.Gorm().Create(&models.LibraryMedia{Type: "SHOW", TmdbID: 1}).Error)
	require.NoError(t, database.Gorm().Create(&models.WatchHistory{AccountID: 1, MediaID: 1, EpisodeNumber: 8, CurrentTime: 100, Duration: 100}).Error)
	progress, err := BuildChronologyProgress(database, 1)
	require.NoError(t, err)
	for _, series := range progress.Series {
		require.Empty(t, series.WatchedEpisodes)
	}
}
