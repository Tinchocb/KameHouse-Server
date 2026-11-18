package handlers

import (
	"net/http"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func TestManualProgressRejectsAmbiguousIdentityWithoutChangingEitherTitle(t *testing.T) {
	app, _ := setupTestApp(t)
	rows := []models.LibraryMedia{{Type: "SHOW", TmdbID: 77}, {Type: "ANIME", TmdbID: 77, MyanimelistId: 77}}
	require.NoError(t, app.Database.Gorm().Create(&rows).Error)
	for i, path := range []string{"show.mkv", "anime.mkv"} {
		require.NoError(t, app.Database.Gorm().Create(&models.LocalFile{Path: path, MediaID: 77, LibraryMediaId: rows[i].ID}).Error)
		require.NoError(t, app.Database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: rows[i].ID, Progress: i + 1, Score: 8.5}).Error)
	}
	h := &Handler{App: app}
	rec := doRequest(h, echo.New(), http.MethodPost, "/", `{"mediaId":77,"progress":99}`, h.HandleUpdateAnimeEntryProgress)
	require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
	for i := range rows {
		got, err := db.GetMediaEntryListData(app.Database, rows[i].ID)
		require.NoError(t, err)
		require.Equal(t, i+1, got.Progress)
		require.Equal(t, 8.5, got.Score)
	}
}
