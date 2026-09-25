package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kamehouse/internal/database/models"
	"kamehouse/internal/util/cache"
)

func TestEtagMatches(t *testing.T) {
	etag := `"0123456789abcdef"`
	assert.True(t, etagMatches(etag, etag))
	assert.True(t, etagMatches(`W/"0123456789abcdef"`, etag))
	assert.True(t, etagMatches(`"other", "0123456789abcdef"`, etag))
	assert.True(t, etagMatches("*", etag))
	assert.False(t, etagMatches("", etag))
	assert.False(t, etagMatches(`"other"`, etag))
}

func TestHandleGetVideoThumbnail_CacheHeaders(t *testing.T) {
	app, tempDir := setupTestApp(t)
	logger := zerolog.Nop()
	app.Logger = &logger
	app.Config.Cache.Dir = filepath.Join(tempDir, "cache")
	thumbCache, err := cache.NewThumbnailCache(10)
	require.NoError(t, err)
	app.ThumbnailCache = thumbCache

	libraryDir := filepath.Join(tempDir, "anime_library")
	require.NoError(t, os.MkdirAll(libraryDir, 0755))
	_, err = app.Database.UpsertSettings(&models.Settings{
		BaseModel: models.BaseModel{ID: 1},
		Library:   models.LibrarySettings{SeriesPaths: []string{libraryDir}},
	})
	require.NoError(t, err)

	videoPath := filepath.Join(libraryDir, "ep01.mkv")
	require.NoError(t, os.WriteFile(videoPath, []byte("not-a-real-video"), 0644))
	videoStat, err := os.Stat(videoPath)
	require.NoError(t, err)

	hash := thumbnailHash(videoPath, videoStat, nil)
	thumbCache.Set(hash, []byte("jpeg-bytes"))

	h := &Handler{App: app}
	e := echo.New()
	get := func(query string, headers map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/video-thumbnail?"+query, nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		require.NoError(t, h.HandleGetVideoThumbnail(e.NewContext(req, rec)))
		return rec
	}
	pathQuery := "path=" + url.QueryEscape(videoPath)

	// Memory hit: 200 with ETag so the browser can revalidate later.
	rec := get(pathQuery, nil)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "jpeg-bytes", rec.Body.String())
	eTag := rec.Header().Get("ETag")
	assert.Equal(t, thumbnailETag(hash), eTag)
	assert.Equal(t, thumbnailCacheControlDefault, rec.Header().Get("Cache-Control"))

	// Revalidation: 304 without body.
	rec = get(pathQuery, map[string]string{"If-None-Match": eTag})
	assert.Equal(t, http.StatusNotModified, rec.Code)
	assert.Empty(t, rec.Body.String())

	// Versioned URL: cacheable forever.
	rec = get(pathQuery+"&v=abc", nil)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, thumbnailCacheControlImmutable, rec.Header().Get("Cache-Control"))

	// A recently failed extraction answers fast and is never cached by the browser.
	offset := 42
	failedHash := thumbnailHash(videoPath, videoStat, &offset)
	thumbnailFailed.Store(failedHash, time.Now())
	t.Cleanup(clearThumbnailFailures)
	rec = get(pathQuery+"&t=42", nil)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Empty(t, rec.Header().Get("Cache-Control"))
	assert.Empty(t, rec.Header().Get("ETag"))
}
