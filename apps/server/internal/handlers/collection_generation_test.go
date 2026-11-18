package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/platforms/simulated_platform"
)

type blockedCollectionPlatform struct {
	simulated_platform.SimulatedPlatform
	calls                           atomic.Int32
	oldStarted, newStarted, release chan struct{}
	fail                            bool
}

func (p *blockedCollectionPlatform) GetAnimeCollection(context.Context, bool) (interface{}, error) {
	if p.calls.Add(1) == 1 {
		close(p.oldStarted)
		<-p.release
		if p.fail {
			return nil, errors.New("old generation fixture")
		}
		return &platform.UnifiedCollection{}, nil
	}
	close(p.newStarted)
	if p.fail {
		return nil, errors.New("new generation fixture")
	}
	return &platform.UnifiedCollection{}, nil
}

func TestCollectionInvalidationDoesNotJoinRetiredBuild(t *testing.T) {
	ClearLibraryCollectionCache()
	t.Cleanup(ClearLibraryCollectionCache)
	p := &blockedCollectionPlatform{oldStarted: make(chan struct{}), newStarted: make(chan struct{}), release: make(chan struct{}), fail: true}
	app := &core.App{}
	app.Metadata.Platform = platform.NewDynamicPlatform(p)
	h := &Handler{App: app}
	e := echo.New()
	oldDone, newDone := make(chan struct{}), make(chan struct{})
	request := func(done chan struct{}) {
		defer close(done)
		rec := httptest.NewRecorder()
		_ = h.HandleGetLibraryCollection(e.NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil), rec))
	}
	go request(oldDone)
	<-p.oldStarted
	ClearLibraryCollectionCache()
	go request(newDone)
	select {
	case <-p.newStarted:
	case <-time.After(250 * time.Millisecond):
		t.Error("new generation waited behind the retired collection build")
	}
	close(p.release)
	<-oldDone
	<-newDone
}

func TestCollectionRetiredBuildCannotReplaceNewCache(t *testing.T) {
	ClearLibraryCollectionCache()
	t.Cleanup(ClearLibraryCollectionCache)
	logger := zerolog.Nop()
	database, err := db.NewDatabase(t.Context(), t.TempDir(), "generation", &logger)
	require.NoError(t, err)
	defer database.Close()
	p := &blockedCollectionPlatform{oldStarted: make(chan struct{}), newStarted: make(chan struct{}), release: make(chan struct{})}
	app := &core.App{}
	app.Database = database
	app.Logger = &logger
	app.Metadata.Platform = platform.NewDynamicPlatform(p)
	h := &Handler{App: app}
	e := echo.New()
	request := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		if err := h.HandleGetLibraryCollection(e.NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil), rec)); err != nil {
			t.Error(err)
		}
		return rec
	}
	oldDone := make(chan *httptest.ResponseRecorder, 1)
	go func() { oldDone <- request() }()
	<-p.oldStarted
	var release sync.Once
	var oldResponse *httptest.ResponseRecorder
	defer func() {
		release.Do(func() { close(p.release) })
		if oldResponse == nil {
			<-oldDone
		}
	}()
	ClearLibraryCollectionCache()
	newResponse := request()
	require.Equal(t, http.StatusOK, newResponse.Code, newResponse.Body.String())
	newCollection, ok := libraryCollectionCache.Get("main")
	require.True(t, ok)
	release.Do(func() { close(p.release) })
	oldResponse = <-oldDone
	require.Equal(t, http.StatusOK, oldResponse.Code, oldResponse.Body.String())
	require.NotEqual(t, oldResponse.Header().Get("ETag"), newResponse.Header().Get("ETag"))
	after, ok := libraryCollectionCache.Get("main")
	require.True(t, ok)
	require.Same(t, newCollection, after, "a retired build must not republish over the fresh collection")
}

func TestCollectionConditionalETagList(t *testing.T) {
	ClearLibraryCollectionCache()
	t.Cleanup(ClearLibraryCollectionCache)
	etag := getCollectionETag()
	for _, header := range []string{`"other", ` + etag, strings.TrimPrefix(etag, "W/"), "  " + etag + "  ", "*"} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/library/collection", nil)
		req.Header.Set("If-None-Match", header)
		rec := httptest.NewRecorder()
		// A matching conditional request must not need an app or build a collection.
		h := &Handler{}
		require.NoError(t, h.HandleGetLibraryCollection(echo.New().NewContext(req, rec)))
		require.Equal(t, http.StatusNotModified, rec.Code, header)
		require.Empty(t, rec.Body.String())
	}
}
