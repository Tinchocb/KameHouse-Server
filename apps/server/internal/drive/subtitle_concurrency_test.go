package drive

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func concurrentSubtitleService(tb testing.TB, metadata, lists *atomic.Int64) *Service {
	tb.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/files" {
			metadata.Add(1)
			_ = json.NewEncoder(w).Encode(map[string]any{"parents": []string{"folderA"}})
			return
		}
		lists.Add(1)
		select {
		case <-time.After(10 * time.Millisecond):
		case <-r.Context().Done():
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"files": []map[string]string{{"id": "subtitle", "name": "episode.es.srt"}}})
	}))
	tb.Cleanup(srv.Close)
	logger := zerolog.Nop()
	return &Service{logger: &logger, enabled: true, client: testClient(srv)}
}

func runConcurrentSubtitleEpisodes(ctx context.Context, svc *Service) []error {
	var wg sync.WaitGroup
	errs := make([]error, 10)
	start := make(chan struct{})
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			_, errs[i] = svc.SiblingSubtitleFiles(ctx, fmt.Sprintf("episode-%d", i))
		}(i)
	}
	close(start)
	wg.Wait()
	return errs
}

func TestConcurrentSubtitleEpisodesShareFolderListing(t *testing.T) {
	var metadata, lists atomic.Int64
	svc := concurrentSubtitleService(t, &metadata, &lists)
	for _, err := range runConcurrentSubtitleEpisodes(t.Context(), svc) {
		require.NoError(t, err)
	}
	require.Equal(t, int64(10), metadata.Load())
	require.Equal(t, int64(1), lists.Load(), "cold episodes must share one folder request")
}

func BenchmarkConcurrentSubtitleEpisodes(b *testing.B) {
	var metadata, lists atomic.Int64
	svc := concurrentSubtitleService(b, &metadata, &lists)
	b.ReportAllocs()
	for b.Loop() {
		svc = &Service{logger: svc.logger, enabled: true, client: &Client{httpClient: svc.client.httpClient, apiBase: svc.client.apiBase, logger: svc.logger}}
		for _, err := range runConcurrentSubtitleEpisodes(b.Context(), svc) {
			if err != nil {
				b.Fatal(err)
			}
		}
	}
	b.ReportMetric(float64(metadata.Load()+lists.Load())/float64(b.N), "req/op")
}

type subtitleWaitContext struct {
	context.Context
	observed chan struct{}
	once     sync.Once
}

func (c *subtitleWaitContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.observed) })
	return c.Context.Done()
}

type folderLoadAnswer struct {
	entry subtitleListEntry
	err   error
}

func startSubtitleFolderLoad(ctx context.Context, client *Client) <-chan folderLoadAnswer {
	done := make(chan folderLoadAnswer, 1)
	go func() {
		entry, err := client.cachedFolderSubtitles(ctx, "folderA")
		done <- folderLoadAnswer{entry, err}
	}()
	return done
}

func awaitSubtitleSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(3 * time.Second):
		t.Fatal("subtitle load did not reach expected stage")
	}
}

func awaitSubtitleLoad(t *testing.T, done <-chan folderLoadAnswer) folderLoadAnswer {
	t.Helper()
	select {
	case answer := <-done:
		return answer
	case <-time.After(3 * time.Second):
		t.Fatal("subtitle load did not finish")
		return folderLoadAnswer{}
	}
}

func TestSubtitleWaiterCancellationDoesNotCancelOwner(t *testing.T) {
	started, release, ownerCanceled := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var lists atomic.Int64
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lists.Add(1)
		close(started)
		select {
		case <-release:
			_, _ = w.Write([]byte(`{"files":[]}`))
		case <-r.Context().Done():
			close(ownerCanceled)
		}
	}))
	defer func() { unblock(); srv.Close() }()
	client := testClient(srv)
	owner := startSubtitleFolderLoad(t.Context(), client)
	awaitSubtitleSignal(t, started)
	waitCtx, cancel := context.WithCancel(t.Context())
	defer cancel()
	observed := &subtitleWaitContext{Context: waitCtx, observed: make(chan struct{})}
	waiter := startSubtitleFolderLoad(observed, client)
	awaitSubtitleSignal(t, observed.observed)
	cancel()
	require.ErrorIs(t, awaitSubtitleLoad(t, waiter).err, context.Canceled)
	select {
	case <-ownerCanceled:
		t.Fatal("canceling waiter canceled HTTP producer")
	default:
	}
	unblock()
	require.NoError(t, awaitSubtitleLoad(t, owner).err)
	require.Equal(t, int64(1), lists.Load())
	client.subtitleCache().mu.Lock()
	pending := len(client.subtitleCache().loading)
	client.subtitleCache().mu.Unlock()
	require.Zero(t, pending)
}

func TestSubtitleOwnerCancellationLetsLiveWaiterRetry(t *testing.T) {
	started := make(chan struct{})
	var lists atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if lists.Add(1) == 1 {
			close(started)
			<-r.Context().Done()
			return
		}
		_, _ = w.Write([]byte(`{"files":[{"id":"subtitle","name":"episode.srt"}]}`))
	}))
	defer srv.Close()
	client := testClient(srv)
	ownerCtx, cancel := context.WithCancel(t.Context())
	defer cancel()
	owner := startSubtitleFolderLoad(ownerCtx, client)
	awaitSubtitleSignal(t, started)
	observed := &subtitleWaitContext{Context: t.Context(), observed: make(chan struct{})}
	waiter := startSubtitleFolderLoad(observed, client)
	awaitSubtitleSignal(t, observed.observed)
	cancel()
	require.ErrorIs(t, awaitSubtitleLoad(t, owner).err, context.Canceled)
	answer := awaitSubtitleLoad(t, waiter)
	require.NoError(t, answer.err)
	require.Len(t, answer.entry.files, 1)
	require.Equal(t, int64(2), lists.Load())
	_, err := client.cachedFolderSubtitles(t.Context(), "folderA")
	require.NoError(t, err)
	require.Equal(t, int64(2), lists.Load(), "live producer should populate normal cache")
}

func TestSubtitleFolderFailureSharedOnlyWithCurrentWaiters(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	defer unblock()
	var lists atomic.Int64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if lists.Add(1) == 1 {
			close(started)
			<-release
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte(`{"files":[]}`))
	}))
	defer func() { unblock(); srv.Close() }()
	client := testClient(srv)
	owner := startSubtitleFolderLoad(t.Context(), client)
	awaitSubtitleSignal(t, started)
	observed := &subtitleWaitContext{Context: t.Context(), observed: make(chan struct{})}
	waiter := startSubtitleFolderLoad(observed, client)
	awaitSubtitleSignal(t, observed.observed)
	unblock()
	require.Error(t, awaitSubtitleLoad(t, owner).err)
	require.Error(t, awaitSubtitleLoad(t, waiter).err)
	require.Equal(t, int64(1), lists.Load())
	_, err := client.cachedFolderSubtitles(t.Context(), "folderA")
	require.NoError(t, err)
	require.Equal(t, int64(2), lists.Load(), "failed flight must not cache errors")
}
