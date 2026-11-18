package metadata_provider

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"kamehouse/internal/api/tmdb"
)

type tmdbFixtureTransport struct {
	target string
	base   http.RoundTripper
}

func (tr tmdbFixtureTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	copy := r.Clone(r.Context())
	u := *r.URL
	target := strings.TrimPrefix(tr.target, "http://")
	u.Scheme = "http"
	u.Host = target
	copy.URL = &u
	copy.Header = copy.Header.Clone()
	copy.Header.Del("Authorization")
	return tr.base.RoundTrip(copy)
}

func TestTMDBColdSeasonLoadLatency(t *testing.T) {
	var active, peak, calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !strings.Contains(r.URL.Path, "/season/") {
			fmt.Fprint(w, `{"id":99999,"name":"Fixture","number_of_seasons":6}`)
			return
		}
		calls.Add(1)
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
		var season int
		_, err := fmt.Sscanf(r.URL.Path, "/3/tv/99999/season/%d", &season)
		if err != nil {
			t.Errorf("path: %s", r.URL.Path)
		}
		fmt.Fprintf(w, `{"season_number":%d,"episodes":[{"episode_number":1,"name":"Season %d episode","season_number":%d}]}`, season, season, season)
	}))
	defer server.Close()
	client := tmdb.NewClient("isolated-fixture-token")
	client.SetHTTPClient(&http.Client{Transport: tmdbFixtureTransport{target: server.URL, base: server.Client().Transport}})
	p := NewTMDBProviderImpl(client, nil, nil)
	start := time.Now()
	result, err := p.GetAnimeMetadata(99999)
	elapsed := time.Since(start)
	require.NoError(t, err)
	require.Equal(t, 6, result.EpisodeCount)
	require.Equal(t, 1, result.SpecialCount)
	for season := 1; season <= 6; season++ {
		require.Equal(t, fmt.Sprintf("Season %d episode", season), result.Episodes[fmt.Sprint(season)].Title)
	}
	before := calls.Load()
	warmStart := time.Now()
	_, err = p.GetAnimeMetadata(99999)
	warmElapsed := time.Since(warmStart)
	require.NoError(t, err)
	require.Equal(t, before, calls.Load())
	require.LessOrEqual(t, peak.Load(), int32(4))
	t.Logf("cold=%s warm=%s season_requests=%d peak=%d", elapsed, warmElapsed, calls.Load(), peak.Load())
}

func TestTMDBSeasonGapPreservesBoundary(t *testing.T) {
	var afterGap atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if !strings.Contains(r.URL.Path, "/season/") {
			fmt.Fprint(w, `{"id":99999,"name":"Fixture","number_of_seasons":12}`)
			return
		}
		var season int
		_, err := fmt.Sscanf(r.URL.Path, "/3/tv/99999/season/%d", &season)
		if err != nil {
			t.Errorf("unexpected season path: %s", r.URL.Path)
			http.Error(w, "invalid fixture path", 500)
			return
		}
		if season >= 4 {
			afterGap.Add(1)
		}
		if season == 0 || season == 2 {
			w.WriteHeader(404)
			return
		}
		fmt.Fprintf(w, `{"name":"Season","overview":"Available","episodes":[{"episode_number":1,"name":"Episode","overview":"Available","season_number":%d}]}`, season)
	}))
	defer server.Close()
	client := tmdb.NewClient("fixture", "en-US")
	client.SetHTTPClient(&http.Client{Transport: tmdbFixtureTransport{target: server.URL, base: server.Client().Transport}})
	p := NewTMDBProviderImpl(client, nil, nil)
	result, err := p.GetAnimeMetadata(99999)
	require.NoError(t, err)
	require.Equal(t, 1, result.EpisodeCount)
	require.Equal(t, 0, result.SpecialCount)
	require.Equal(t, 1, result.Episodes["1"].SeasonNumber)
	require.Zero(t, afterGap.Load(), "a gap must prevent fetching subsequent batches")
}

func TestTMDBSeasonConcurrencySharedAndCancelled(t *testing.T) {
	var active, peak, calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
		fmt.Fprint(w, `{"episodes":[{"episode_number":1}]}`)
	}))
	defer server.Close()
	client := tmdb.NewClient("fixture", "en-US")
	client.SetHTTPClient(&http.Client{Transport: tmdbFixtureTransport{target: server.URL, base: server.Client().Transport}})
	p := NewTMDBProviderImpl(client, nil, nil)
	var workers sync.WaitGroup
	for _, id := range []int{9001, 9002} {
		workers.Go(func() { p.loadSeasons(t.Context(), id, 3) })
	}
	workers.Wait()
	require.Equal(t, int32(8), calls.Load())
	require.LessOrEqual(t, peak.Load(), int32(4))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	p.loadSeasons(ctx, 9003, 3)
	require.Equal(t, int32(8), calls.Load(), "cancelled loads must not issue HTTP")
}
