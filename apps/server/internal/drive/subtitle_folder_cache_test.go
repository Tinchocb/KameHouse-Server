package drive

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestFolderListingRetainsOriginalExpiryAndRefreshesWhenExpired(t *testing.T) {
	var metadata, lists atomic.Int64
	srv := subtitleFolderServer(t, &metadata, &lists)
	logger := zerolog.Nop()
	svc := &Service{logger: &logger, enabled: true, client: testClient(srv)}
	_, err := svc.SiblingSubtitleFiles(t.Context(), "episode-first")
	require.NoError(t, err)
	cache := svc.client.subtitleCache()
	entry, ok := cache.folders.Get("folderA")
	require.True(t, ok)
	entry.expiresAt = time.Now().Add(time.Minute)
	cache.folders.SetT("folderA", entry, subtitleListTTL)
	_, err = svc.SiblingSubtitleFiles(t.Context(), "episode-next")
	require.NoError(t, err)
	next, ok := cache.files.Get("episode-next")
	require.True(t, ok)
	require.Equal(t, entry.expiresAt, next.expiresAt, "a new file must not extend an old folder listing's TTL")
	entry.expiresAt = time.Now().Add(-time.Second)
	cache.folders.SetT("folderA", entry, subtitleListTTL)
	_, err = svc.SiblingSubtitleFiles(t.Context(), "episode-after-expiry")
	require.NoError(t, err)
	require.Equal(t, int64(2), lists.Load())
}

func TestSubtitleListingErrorsAreNotCached(t *testing.T) {
	var deny atomic.Bool
	deny.Store(true)
	var lists atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/files" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"parents": []string{"parent"}})
			return
		}
		lists.Add(1)
		if deny.Load() {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"files": []interface{}{}})
	}))
	defer srv.Close()
	logger := zerolog.Nop()
	svc := &Service{logger: &logger, enabled: true, client: testClient(srv)}
	_, err := svc.SiblingSubtitleFiles(t.Context(), "episode-retry")
	require.Error(t, err)
	deny.Store(false)
	_, err = svc.SiblingSubtitleFiles(t.Context(), "episode-retry")
	require.NoError(t, err)
	require.Equal(t, int32(2), lists.Load())
}

func subtitleFolderServer(tb testing.TB, metadata, lists *atomic.Int64) *httptest.Server {
	tb.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/files/episode-"):
			metadata.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"parents": []string{"folderA"}})
		case r.URL.Path == "/files":
			lists.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"files": []map[string]string{{"id": "subtitle", "name": "episode.es.srt"}}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	tb.Cleanup(srv.Close)
	return srv
}

func TestSiblingEpisodesReuseFolderListing(t *testing.T) {
	var metadata, lists atomic.Int64
	srv := subtitleFolderServer(t, &metadata, &lists)
	logger := zerolog.Nop()
	svc := &Service{logger: &logger, enabled: true, client: testClient(srv)}
	for i := 0; i < 10; i++ {
		files, err := svc.SiblingSubtitleFiles(t.Context(), fmt.Sprintf("episode-%d", i))
		require.NoError(t, err)
		require.Len(t, files, 1)
		files[0].Name = "caller mutation"
	}
	require.Equal(t, int64(10), metadata.Load())
	require.Equal(t, int64(1), lists.Load(), "episodes sharing a parent must reuse its subtitle listing")
}

func BenchmarkSiblingSubtitleEpisodes(b *testing.B) {
	var metadata, lists atomic.Int64
	srv := subtitleFolderServer(b, &metadata, &lists)
	logger := zerolog.Nop()
	b.ReportAllocs()
	for b.Loop() {
		svc := &Service{logger: &logger, enabled: true, client: testClient(srv)}
		for i := 0; i < 10; i++ {
			if _, err := svc.SiblingSubtitleFiles(b.Context(), fmt.Sprintf("episode-%d", i)); err != nil {
				b.Fatal(err)
			}
		}
	}
	b.ReportMetric(float64(metadata.Load()+lists.Load())/float64(b.N), "req/op")
}
