package drive

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"
)

func TestBlockCacheClearRetiresPendingDownloadWithoutInterruptingReader(t *testing.T) {
	c := newTestCache(t, 4, 1024)
	c.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve + 4096, nil }
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	upstream := func(context.Context, string) (*http.Response, error) {
		close(started)
		<-release
		return &http.Response{StatusCode: 206, Header: http.Header{"Content-Range": {"bytes 0-3/4"}}, Body: io.NopCloser(bytes.NewBufferString("old!"))}, nil
	}
	type answer struct {
		data []byte
		err  error
	}
	done := make(chan answer, 1)
	go func() {
		resp, err := c.FetcherWithoutReadAhead("pending", upstream)(context.Background(), "bytes=0-3")
		if err != nil {
			done <- answer{err: err}
			return
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		done <- answer{data, err}
	}()
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("download did not start")
	}
	c.Clear()
	unblock()
	select {
	case got := <-done:
		if got.err != nil || string(got.data) != "old!" {
			t.Fatalf("active reader: %q, %v", got.data, got.err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("active reader blocked after clear")
	}
	waitIdle(t, c)
	entries, err := os.ReadDir(c.Dir())
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("retired download repopulated cleared cache: %v", entries)
	}
	newUpstream := &cacheUpstream{data: []byte("new!")}
	if got := readCached(t, c.FetcherWithoutReadAhead("pending", newUpstream.fetch), 0, 3); string(got) != "new!" {
		t.Fatalf("new request reused retired data: %q", got)
	}
	waitIdle(t, c)
	if _, blocks := c.Stats(); blocks != 1 {
		t.Fatalf("new request did not persist: %d blocks", blocks)
	}
}

type blockedCacheBody struct {
	io.Reader
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (b *blockedCacheBody) Read(p []byte) (int, error) {
	b.once.Do(func() { close(b.started) })
	<-b.release
	return b.Reader.Read(p)
}

func (b *blockedCacheBody) Close() error { return nil }

func TestBlockCacheClearSeparatesNewReadersFromPendingBody(t *testing.T) {
	c := newTestCache(t, 4, 1024)
	c.freeBytes = func(string) (uint64, error) { return blockCacheDiskReserve + 4096, nil }
	body := &blockedCacheBody{Reader: bytes.NewBufferString("old!"), started: make(chan struct{}), release: make(chan struct{})}
	var once sync.Once
	unblock := func() { once.Do(func() { close(body.release) }) }
	defer unblock()
	oldUpstream := &cacheUpstream{data: []byte("old!OLD!")}
	upstream := func(ctx context.Context, header string) (*http.Response, error) {
		if header == "bytes=0-3" {
			return &http.Response{StatusCode: 206, Header: http.Header{"Content-Range": {"bytes 0-3/8"}}, Body: body}, nil
		}
		return oldUpstream.fetch(ctx, header)
	}
	old, err := c.FetcherWithoutReadAhead("pending", upstream)(t.Context(), "bytes=0-7")
	if err != nil {
		t.Fatal(err)
	}
	defer old.Body.Close()
	select {
	case <-body.started:
	case <-time.After(3 * time.Second):
		t.Fatal("body download did not start")
	}
	c.Clear()
	newUpstream := &cacheUpstream{data: []byte("new!NEW!")}
	if got := readCached(t, c.FetcherWithoutReadAhead("pending", newUpstream.fetch), 0, 7); string(got) != "new!NEW!" {
		t.Fatalf("new request joined retired download: %q", got)
	}
	unblock()
	got, err := io.ReadAll(old.Body)
	if err != nil || string(got) != "old!OLD!" {
		t.Fatalf("old reader lost its download: %q, %v", got, err)
	}
	waitIdle(t, c)
	if got := readCached(t, c.FetcherWithoutReadAhead("pending", newUpstream.fetch), 0, 7); string(got) != "new!NEW!" {
		t.Fatalf("retired writer replaced fresh block: %q", got)
	}
}
