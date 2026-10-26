package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kamehouse/internal/library/anime"
)

func TestHandleGetLibraryCollection_ETagAnd304(t *testing.T) {
	e := echo.New()
	h := &Handler{}

	// Seed cache with dummy collection
	ClearLibraryCollectionCache()
	dummy := &anime.LibraryCollection{
		Lists: []*anime.LibraryCollectionList{},
	}
	libraryCollectionCache.SetT("main", dummy, 5*time.Minute)

	// 1. First GET request returns ETag and 200 OK
	req := httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := h.HandleGetLibraryCollection(c)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	etag := rec.Header().Get("ETag")
	assert.NotEmpty(t, etag)
	assert.Equal(t, "no-cache", rec.Header().Get("Cache-Control"))

	// 2. Second GET with matching If-None-Match returns 304 Not Modified and empty body
	req304 := httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil)
	req304.Header.Set("If-None-Match", etag)
	rec304 := httptest.NewRecorder()
	c304 := e.NewContext(req304, rec304)

	err = h.HandleGetLibraryCollection(c304)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotModified, rec304.Code)
	assert.Empty(t, rec304.Body.String())

	// 3. ClearLibraryCollectionCache increments version, so previous ETag no longer returns 304
	ClearLibraryCollectionCache()
	libraryCollectionCache.SetT("main", dummy, 5*time.Minute)

	reqStale := httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil)
	reqStale.Header.Set("If-None-Match", etag) // using old etag
	recStale := httptest.NewRecorder()
	cStale := e.NewContext(reqStale, recStale)

	err = h.HandleGetLibraryCollection(cStale)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recStale.Code)
	newEtag := recStale.Header().Get("ETag")
	assert.NotEqual(t, etag, newEtag)
}
