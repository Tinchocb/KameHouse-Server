package videofile

import (
	"context"
	"errors"
	"github.com/rs/zerolog"
	"kamehouse/internal/util/filecache"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestExtractorCloseCancelsAndJoinsAdmittedWork(t *testing.T) {
	l := zerolog.Nop()
	e := NewMediaInfoExtractor(nil, &l)
	if !e.begin() {
		t.Fatal("work rejected before close")
	}
	closed := make(chan struct{})
	go func() { e.Close(); close(closed) }()
	<-e.ctx.Done()
	select {
	case <-closed:
		t.Fatal("Close returned before admitted worker finished")
	default:
	}
	if e.begin() {
		t.Fatal("admitted work during shutdown")
	}
	e.workers.Done()
	select {
	case <-closed:
	case <-time.After(time.Second):
		t.Fatal("Close did not finish")
	}
	_, err := e.GetInfoContext(context.Background(), "unused", "unused")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("read after close: %v", err)
	}
	e.Close()
}

type extractorWaitingContext struct {
	context.Context
	waiting chan struct{}
	once    sync.Once
}

func (c *extractorWaitingContext) Done() <-chan struct{} {
	c.once.Do(func() { close(c.waiting) })
	return c.Context.Done()
}

func TestSharedProbeSurvivesCallerButStopsWithExtractor(t *testing.T) {
	for _, closeExtractor := range []bool{false, true} {
		name := "remaining-caller-receives-result"
		if closeExtractor {
			name = "shutdown-cancels-shared-producer"
		}
		t.Run(name, func(t *testing.T) {
			cache, err := filecache.NewCacher(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = cache.Close() })
			l := zerolog.Nop()
			e := NewMediaInfoExtractor(cache, &l)
			t.Cleanup(e.Close)
			started, finished, release := make(chan struct{}), make(chan struct{}), make(chan struct{})
			var calls atomic.Int32
			e.probe = func(ctx context.Context, _, _, _ string) (*MediaInfo, error) {
				calls.Add(1)
				close(started)
				defer close(finished)
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-release:
					return &MediaInfo{Duration: 2}, nil
				}
			}
			firstCtx, cancelFirst := context.WithCancel(context.Background())
			defer cancelFirst()
			secondCtx, cancelSecond := context.WithCancel(context.Background())
			defer cancelSecond()
			waiting := &extractorWaitingContext{Context: secondCtx, waiting: make(chan struct{})}
			const path = "http://fixture.invalid/episode.mkv"
			first, second := make(chan error, 1), make(chan error, 1)
			go func() { _, err := e.GetInfoContext(firstCtx, "unused", path); first <- err }()
			select {
			case <-started:
			case <-time.After(3 * time.Second):
				t.Fatal("producer did not start")
			}
			go func() { _, err := e.GetInfoContext(waiting, "unused", path); second <- err }()
			select {
			case <-waiting.waiting:
			case <-time.After(3 * time.Second):
				t.Fatal("second caller did not join")
			}
			cancelFirst()
			select {
			case err := <-first:
				if !errors.Is(err, context.Canceled) {
					t.Fatalf("first caller: %v", err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("first caller remained blocked")
			}
			select {
			case <-finished:
				t.Fatal("caller cancellation stopped shared producer")
			default:
			}
			if closeExtractor {
				e.Close()
			} else {
				close(release)
			}
			select {
			case err := <-second:
				if closeExtractor && !errors.Is(err, context.Canceled) {
					t.Fatalf("shutdown did not cancel producer: %v", err)
				}
				if !closeExtractor && err != nil {
					t.Fatalf("remaining caller lost result: %v", err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("remaining caller did not finish")
			}
			e.Close()
			if calls.Load() != 1 {
				t.Fatalf("probe ran %d times", calls.Load())
			}
			hash, _ := GetHashFromPath(path)
			var cached *MediaInfo
			found, _ := cache.Get(filecache.NewBucket(MediaInfoBucketName, 24*time.Hour), hash, &cached)
			if found == closeExtractor {
				t.Fatalf("unexpected cache publication after shutdown=%v", closeExtractor)
			}
		})
	}
}
