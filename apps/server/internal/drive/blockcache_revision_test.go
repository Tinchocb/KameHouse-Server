package drive

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"
	"time"
)

func TestBlockCacheRevisionReplacesSameSizeContent(t *testing.T) {
	c := newTestCache(t, 4, 1024)
	f := &cacheUpstream{data: []byte("old-data")}
	c.ValidateRevision("sameID", 8, "checksum-old")
	fetch := c.FetcherWithoutReadAhead("sameID", f.fetch)
	if got := readCached(t, fetch, 0, 3); string(got) != "old-" {
		t.Fatal(string(got))
	}
	waitIdle(t, c)
	f.mu.Lock()
	f.data = []byte("new-data")
	f.mu.Unlock()
	c.ValidateRevision("sameID", 8, "checksum-new")
	if got := readCached(t, fetch, 0, 3); string(got) != "new-" {
		t.Fatalf("stale bytes: %s", got)
	}
	waitIdle(t, c)
	// The revision namespace is deterministic across process restarts.
	c2, err := NewBlockCache(c.Dir(), 4, 1024)
	if err != nil {
		t.Fatal(err)
	}
	c2.ValidateRevision("sameID", 8, "checksum-new")
	before := f.requests.Load()
	if got := readCached(t, c2.FetcherWithoutReadAhead("sameID", f.fetch), 0, 3); string(got) != "new-" {
		t.Fatal(string(got))
	}
	if f.requests.Load() != before {
		t.Fatal("revision cache was not reused after restart")
	}
}

func TestBlockCacheRevisionIsolatesInflightDownload(t *testing.T) {
	c := newTestCache(t, 4, 1024)
	c.ValidateRevision("sameID", 4, "old")
	started, release := make(chan struct{}), make(chan struct{})
	oldFetch := func(context.Context, string) (*http.Response, error) {
		close(started)
		<-release
		return &http.Response{StatusCode: 206, Header: http.Header{"Content-Range": {"bytes 0-3/4"}}, Body: io.NopCloser(bytes.NewReader([]byte("old!")))}, nil
	}
	oldDone := make(chan []byte, 1)
	go func() {
		resp, err := c.FetcherWithoutReadAhead("sameID", oldFetch)(context.Background(), "bytes=0-3")
		if err != nil {
			oldDone <- nil
			return
		}
		defer resp.Body.Close()
		got, _ := io.ReadAll(resp.Body)
		oldDone <- got
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("old download did not start")
	}
	c.ValidateRevision("sameID", 4, "new")
	f := &cacheUpstream{data: []byte("new!")}
	if got := readCached(t, c.FetcherWithoutReadAhead("sameID", f.fetch), 0, 3); string(got) != "new!" {
		t.Fatal(string(got))
	}
	close(release)
	select {
	case got := <-oldDone:
		if string(got) != "old!" {
			t.Fatal(string(got))
		}
	case <-time.After(time.Second):
		t.Fatal("old reader blocked")
	}
	waitIdle(t, c)
	if got := readCached(t, c.FetcherWithoutReadAhead("sameID", f.fetch), 0, 3); string(got) != "new!" {
		t.Fatalf("old download contaminated revision: %s", got)
	}
}
