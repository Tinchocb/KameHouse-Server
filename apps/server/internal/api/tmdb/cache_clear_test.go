package tmdb

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type clearFixtureTransport struct {
	url  string
	base http.RoundTripper
}

func (f clearFixtureTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	clone := r.Clone(r.Context())
	clone.URL.Scheme = "http"
	clone.URL.Host = strings.TrimPrefix(f.url, "http://")
	return f.base.RoundTrip(clone)
}

func TestClearRetiresInFlightNetworkPublication(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":42,"title":"Fixture","overview":"Fixture"}`))
	}))
	defer server.Close()
	c := NewClient("fixture", "en-US")
	c.SetHTTPClient(&http.Client{Transport: clearFixtureTransport{server.URL, server.Client().Transport}})
	done := make(chan error, 1)
	go func() { _, err := c.GetMovieDetails(t.Context(), "42"); done <- err }()
	<-started
	c.ClearCache()
	close(release)
	require.NoError(t, <-done)
	_, found := GetCached[*MovieDetails](c, "movie_detail_full:42:en-US")
	require.False(t, found, "retired request repopulated cache")
}
