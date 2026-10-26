package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"kamehouse/internal/continuity"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util/filecache"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestContinuityEpisodeTransitionAndClosePersistence(t *testing.T) {
	a, dir := setupTestApp(t)
	logger := zerolog.Nop()
	cacheDir := filepath.Join(dir, "history-cache")
	cacher, err := filecache.NewCacher(cacheDir)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, cacher.Close()) })
	m := continuity.NewManager(&continuity.NewManagerOptions{FileCacher: cacher, Database: a.Database, Logger: &logger})
	t.Cleanup(m.TelemetryManager.Stop)
	m.SetSettings(&continuity.Settings{WatchContinuityEnabled: true})
	a.ContinuityManager = m
	h := &Handler{App: a}
	e := echo.New()

	for _, body := range []string{
		`{"options":{"mediaId":42,"episodeNumber":1,"currentTime":990,"duration":1000}}`,
		`{"options":{"mediaId":42,"episodeNumber":2,"currentTime":120,"duration":1000}}`,
		`{"options":{"mediaId":42,"episodeNumber":2,"currentTime":0,"duration":0}}`,
	} {
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/continuity/item", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		require.NoError(t, h.HandleUpdateContinuityWatchHistoryItem(e.NewContext(req, rec)))
		require.Equal(t, http.StatusOK, rec.Code)
		require.JSONEq(t, `{"data":true}`, rec.Body.String())
	}

	// Simulate a graceful server close after the final playback PATCH.
	m.TelemetryManager.Stop()
	require.NoError(t, cacher.Close())
	var rows []models.WatchHistory
	require.NoError(t, a.Database.Gorm().Where("account_id = ? AND media_id = ?", localAccountID, 42).Order("episode_number").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, 990.0, rows[0].CurrentTime)
	require.Equal(t, 120.0, rows[1].CurrentTime)

	// The resume endpoint after reopening must identify episode 2, not episode 1.
	reopened, err := filecache.NewCacher(cacheDir)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, reopened.Close()) })
	restored := continuity.NewManager(&continuity.NewManagerOptions{FileCacher: reopened, Database: a.Database, Logger: &logger})
	t.Cleanup(restored.TelemetryManager.Stop)
	restored.SetSettings(&continuity.Settings{WatchContinuityEnabled: true})
	a.ContinuityManager = restored
	c := e.NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/continuity/item/42", nil), httptest.NewRecorder())
	c.SetParamNames("id")
	c.SetParamValues("42")
	require.NoError(t, h.HandleGetContinuityWatchHistoryItem(c))
	var response APIResponse[continuity.WatchHistoryItemResponse]
	require.NoError(t, json.Unmarshal(c.Response().Writer.(*httptest.ResponseRecorder).Body.Bytes(), &response))
	require.True(t, response.Data.Found)
	require.Equal(t, 2, response.Data.Item.EpisodeNumber)
	require.Equal(t, 120.0, response.Data.Item.CurrentTime)
}
