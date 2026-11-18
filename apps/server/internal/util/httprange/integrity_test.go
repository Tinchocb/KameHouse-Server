package httprange

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestTruncatedRangeRetriesBeforePublishingChunk(t *testing.T) {
	old := retryDelays
	retryDelays = []time.Duration{time.Millisecond}
	defer func() { retryDelays = old }()
	data := payload(1000)
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			calls++
			if calls == 1 {
				w.Header().Set("Content-Range", "bytes 0-999/1000")
				w.WriteHeader(http.StatusPartialContent)
				_, _ = w.Write(data[:100])
				return
			}
		}
		http.ServeContent(w, r, "file", time.Time{}, bytes.NewReader(data))
	}))
	defer srv.Close()
	r, err := Open(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	got, err := io.ReadAll(r)
	require.NoError(t, err)
	require.Equal(t, data, got)
	require.Equal(t, 2, calls)
}

func TestWrongRangeNeverEntersCache(t *testing.T) {
	for _, contentRange := range []string{"bytes 1-1000/1001", "bytes 0-999/2000", "bytes 0-998/1000", "", "garbage"} {
		t.Run(contentRange, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Length", "1000")
				if r.Method == http.MethodHead {
					return
				}
				w.Header().Set("Content-Range", contentRange)
				w.WriteHeader(http.StatusPartialContent)
				_, _ = w.Write(make([]byte, 1000))
			}))
			defer srv.Close()
			r, err := Open(t.Context(), srv.Client(), srv.URL)
			require.NoError(t, err)
			_, err = io.ReadAll(r)
			require.Error(t, err)
			require.Empty(t, r.chunks)
		})
	}
}

func TestInvalidResolvedRangeSize(t *testing.T) {
	for _, size := range []int64{0, -1} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			_, err := parseContentRangeTotal(fmt.Sprintf("bytes 0-0/%d", size))
			require.Error(t, err)
		})
	}
}
