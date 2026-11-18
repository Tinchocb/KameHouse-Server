package util

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/imroc/req/v3"
)

func TestPrewarmCancellationStopsAdmissionAndJoinsDownload(t *testing.T) {
	oldValid, oldClient := prewarmURLValid, imageProxyClient
	prewarmURLValid = func(string) bool { return true }
	imageProxyClient = req.C().SetTimeout(time.Second)
	defer func() { prewarmURLValid = oldValid; imageProxyClient = oldClient }()
	started, release := make(chan struct{}), make(chan struct{})
	var hits atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits.Add(1) == 1 {
			close(started)
		}
		<-release
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("\xff\xd8\xff fixture"))
	}))
	defer server.Close()
	var releaseOnce sync.Once
	defer releaseOnce.Do(func() { close(release) })
	ip := &ImageProxy{CacheDir: t.TempDir()}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan int, 1)
	go func() {
		done <- ip.PrewarmContext(ctx, []string{server.URL + "/first.jpg", server.URL + "/second.jpg"}, 1)
	}()
	<-started
	cancel()
	select {
	case <-done:
		t.Fatal("prewarm returned before admitted download joined")
	case <-time.After(20 * time.Millisecond):
	}
	releaseOnce.Do(func() { close(release) })
	select {
	case n := <-done:
		if n != 1 {
			t.Fatalf("completed downloads = %d", n)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("prewarm did not join completed download")
	}
	if hits.Load() != 1 {
		t.Fatalf("cancellation admitted %d HTTP requests", hits.Load())
	}
	if ip.PrewarmContext(ctx, []string{server.URL + "/cancelled.jpg"}, 1) != 0 || hits.Load() != 1 {
		t.Fatal("already-cancelled prewarm issued HTTP")
	}
}
