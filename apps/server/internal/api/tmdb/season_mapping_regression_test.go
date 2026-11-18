package tmdb

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAbsoluteMappingStopsAtMissingSeason(t *testing.T) {
	failed := true
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/tv/1":
			fmt.Fprint(w, `{"number_of_seasons":3,"number_of_episodes":6}`)
		case "/tv/1/season/1":
			fmt.Fprint(w, `{"season_number":1,"episodes":[{"episode_number":1},{"episode_number":2}]}`)
		case "/tv/1/season/2":
			if failed {
				w.WriteHeader(404)
				return
			}
			fmt.Fprint(w, `{"season_number":2,"episodes":[{"episode_number":1}]}`)
		case "/tv/1/season/3":
			fmt.Fprint(w, `{"season_number":3,"episodes":[{"episode_number":1},{"episode_number":2},{"episode_number":3}]}`)
		default:
			t.Errorf("unexpected endpoint %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	old := baseURL
	baseURL = server.URL
	defer func() { baseURL = old }()
	client := NewClient("token", "en-US")
	season, ep, err := client.AbsoluteToStandardMapping(context.Background(), 1, 2)
	require.NoError(t, err)
	require.Equal(t, 1, season)
	require.Equal(t, 2, ep)
	_, _, err = client.AbsoluteToStandardMapping(context.Background(), 1, 4)
	require.Error(t, err)
	failed = false
	season, ep, err = client.AbsoluteToStandardMapping(context.Background(), 1, 4)
	require.NoError(t, err)
	require.Equal(t, 3, season)
	require.Equal(t, 1, ep)
	before := requests
	_, _, err = client.AbsoluteToStandardMapping(context.Background(), 1, 4)
	require.NoError(t, err)
	require.Equal(t, before, requests)
}
