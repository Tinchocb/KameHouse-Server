package handlers

import (
	"encoding/json"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestStoryboardAuthorizationAndVersion(t *testing.T) {
	app, root := setupTestApp(t)
	library := filepath.Join(root, "library")
	require.NoError(t, os.MkdirAll(library, 0755))
	_, err := app.Database.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}, Library: models.LibrarySettings{SeriesPaths: []string{library}}})
	require.NoError(t, err)
	path := filepath.Join(library, "episode.mkv")
	require.NoError(t, os.WriteFile(path, []byte("fixture"), 0644))
	require.NoError(t, app.Database.Gorm().Create(&models.LocalFile{Path: path, Name: "episode.mkv"}).Error)
	h := &Handler{App: app}
	e := echo.New()
	call := func(p, extra string) (*httptest.ResponseRecorder, error) {
		req := httptest.NewRequest("GET", "/api/v1/video-storyboard?path="+url.QueryEscape(p)+extra, nil)
		rec := httptest.NewRecorder()
		err := h.HandleGetStoryboard(e.NewContext(req, rec))
		return rec, err
	}
	rec, err := call(path, "")
	require.NoError(t, err)
	var index map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &index))
	require.Equal(t, float64(10), index["interval"])
	version := index["version"].(string)
	_, err = call(path, "&sheet=0&v=stale")
	require.Equal(t, http.StatusConflict, err.(*echo.HTTPError).Code)
	_, err = call(path, "&sheet=-1&v="+version)
	require.Equal(t, http.StatusBadRequest, err.(*echo.HTTPError).Code)
	_, err = call("http://example.com/video", "")
	require.Equal(t, http.StatusNotFound, err.(*echo.HTTPError).Code)
	outside := filepath.Join(root, "outside.mkv")
	require.NoError(t, os.WriteFile(outside, []byte("x"), 0644))
	require.NoError(t, app.Database.Gorm().Create(&models.LocalFile{Path: outside}).Error)
	_, err = call(outside, "")
	require.Equal(t, http.StatusForbidden, err.(*echo.HTTPError).Code)
	require.NoError(t, os.WriteFile(path, []byte("changed fixture"), 0644))
	rec, err = call(path, "")
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &index))
	require.NotEqual(t, version, index["version"])
}
