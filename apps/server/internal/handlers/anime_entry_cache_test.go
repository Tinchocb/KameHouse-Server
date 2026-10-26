package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"
)

func TestHandleGetAnimeEntry_CacheAndETag(t *testing.T) {
	e := echo.New()
	h := &Handler{}

	ClearAnimeEntryCache()

	// Seed cache with entry for mediaId 123
	mediaID := 123
	dummyEntry := &anime.Entry{
		MediaID: mediaID,
		Media: &models.LibraryMedia{
			BaseModel: models.BaseModel{
				ID:        1,
				UpdatedAt: time.Now(),
			},
			TmdbID: mediaID,
		},
		EntryListData: &anime.EntryListData{
			Progress: 5,
		},
		LocalFiles: []*anime.LocalFile{},
	}
	animeEntryCache.SetT(mediaID, dummyEntry, animeEntryCacheTTL)

	// 1. GET returns 200 OK, ETag, and Cache-Control: no-cache
	req := httptest.NewRequest(http.MethodGet, "/api/v1/library/anime-entry/123", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123")

	err := h.HandleGetAnimeEntry(c)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	etag := rec.Header().Get("ETag")
	assert.NotEmpty(t, etag)
	assert.Equal(t, "no-cache", rec.Header().Get("Cache-Control"))

	// 2. Second GET with matching If-None-Match returns 304 Not Modified and empty body
	req304 := httptest.NewRequest(http.MethodGet, "/api/v1/library/anime-entry/123", nil)
	req304.Header.Set("If-None-Match", etag)
	rec304 := httptest.NewRecorder()
	c304 := e.NewContext(req304, rec304)
	c304.SetParamNames("id")
	c304.SetParamValues("123")

	err = h.HandleGetAnimeEntry(c304)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotModified, rec304.Code)
	assert.Empty(t, rec304.Body.String())

	// 3. InvalidateAnimeEntryCache clears the entry
	InvalidateAnimeEntryCache(mediaID)
	_, found := animeEntryCache.Get(mediaID)
	assert.False(t, found)
}
