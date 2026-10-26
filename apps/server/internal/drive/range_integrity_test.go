package drive

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestChunkedRangeRejectsMismatchedResponses(t *testing.T) {
	for _, stage := range []string{"first", "prefetch", "refetch"} {
		for _, fault := range []string{"status", "start", "total", "end", "syntax"} {
			t.Run(stage+"/"+fault, func(t *testing.T) {
				if stage == "first" && fault == "total" {
					t.Skip("initial response establishes the size")
				}
				f := &quotaDrive{data: testData(12), maxRange: 4}
				var closed atomic.Int32
				fetch := func(ctx context.Context, rh string) (*http.Response, error) {
					if err := ctx.Err(); err != nil {
						return nil, err
					}
					r, err := f.fetch(ctx, rh)
					bad := stage == "first" && rh == "bytes=0-3" || stage == "prefetch" && rh == "bytes=4-7" || stage == "refetch" && rh == "bytes=2-5"
					if stage == "refetch" && rh == "bytes=0-3" {
						r.Body = io.NopCloser(bytes.NewReader(f.data[:2]))
					}
					if bad {
						switch fault {
						case "status":
							r.StatusCode = http.StatusOK
						case "start":
							r.Header.Set("Content-Range", "bytes 1-3/12")
						case "total":
							r.Header.Set("Content-Range", strings.Replace(r.Header.Get("Content-Range"), "/12", "/13", 1))
						case "end":
							r.Header.Set("Content-Range", "bytes 0-99/12")
						case "syntax":
							r.Header.Set("Content-Range", "invalid/12")
						}
						// The initial 200 at offset zero remains supported; make its
						// total unknown to exercise the rejection path instead.
						if stage == "first" && fault == "status" {
							r.ContentLength = -1
						}
						r.Body = &countingCloser{ReadCloser: r.Body, closed: &closed}
					}
					return r, err
				}
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				cr, err := OpenChunkedRange(ctx, fetch, 0, -1, 4)
				if err == nil {
					_, err = io.ReadAll(cr.Body)
					_ = cr.Body.Close()
				}
				if err == nil {
					t.Error("accepted an invalid range response")
				}
				deadline := time.Now().Add(time.Second)
				for closed.Load() == 0 && time.Now().Before(deadline) {
					time.Sleep(time.Millisecond)
				}
				if closed.Load() == 0 {
					t.Error("invalid response body was not closed")
				}
			})
		}
	}
}

type interruptedRangeBody struct {
	sent    bool
	failure error
}

func (b *interruptedRangeBody) Read(p []byte) (int, error) {
	if b.sent {
		return 0, io.EOF
	}
	b.sent = true
	return copy(p, "abc"), b.failure
}
func (*interruptedRangeBody) Close() error { return nil }

func TestChunkedRangeReportsInterruptedBody(t *testing.T) {
	f := &quotaDrive{data: testData(12), maxRange: 4}
	failure := errors.New("synthetic connection reset")
	cr, err := OpenChunkedRange(context.Background(), func(ctx context.Context, rh string) (*http.Response, error) {
		r, err := f.fetch(ctx, rh)
		if rh == "bytes=0-3" {
			r.Body = &interruptedRangeBody{failure: failure}
		}
		return r, err
	}, 0, -1, 4)
	if err != nil {
		t.Fatal(err)
	}
	defer cr.Body.Close()
	b, err := io.ReadAll(cr.Body)
	if !errors.Is(err, failure) || string(b) != "abc" {
		t.Fatalf("interruption hidden: bytes=%x err=%v", b, err)
	}
}

func TestChunkedRangeRejectsNoProgressBody(t *testing.T) {
	f := &quotaDrive{data: testData(12), maxRange: 4}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	cr, err := OpenChunkedRange(ctx, func(ctx context.Context, rh string) (*http.Response, error) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		r, err := f.fetch(ctx, rh)
		r.Body = io.NopCloser(strings.NewReader(""))
		return r, err
	}, 0, -1, 4)
	if err != nil {
		t.Fatal(err)
	}
	defer cr.Body.Close()
	_, err = io.ReadAll(cr.Body)
	if !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("empty successful responses were retried without progress: %v (%d requests)", err, f.requests.Load())
	}
}

func TestChunkedRangeCompletedPrefetchCancelsContexts(t *testing.T) {
	f := &quotaDrive{data: testData(12), maxRange: 4}
	var mu sync.Mutex
	var contexts []context.Context
	cr, err := OpenChunkedRange(context.Background(), func(ctx context.Context, rh string) (*http.Response, error) {
		if rh != "bytes=0-3" {
			mu.Lock()
			contexts = append(contexts, ctx)
			mu.Unlock()
		}
		return f.fetch(ctx, rh)
	}, 0, -1, 4)
	if err != nil {
		t.Fatal(err)
	}
	_, readErr := io.ReadAll(cr.Body)
	_ = cr.Body.Close()
	if readErr != nil {
		t.Fatal(readErr)
	}
	mu.Lock()
	defer mu.Unlock()
	for i, ctx := range contexts {
		if ctx.Err() == nil {
			t.Errorf("completed prefetch %d context retained", i)
		}
	}
}

func TestBlockCacheInterruptedBodyIsNotPersisted(t *testing.T) {
	c := newTestCache(t, 4, 100)
	c.freeBytes = func(string) (uint64, error) { return 100 << 30, nil }
	failure := errors.New("synthetic reset")
	f := &cacheUpstream{data: []byte("abcd")}
	pipe, writer := io.Pipe()
	defer pipe.Close()
	defer writer.Close()
	var calls atomic.Int32
	up := func(ctx context.Context, rh string) (*http.Response, error) {
		r, err := f.fetch(ctx, rh)
		if calls.Add(1) == 1 {
			r.Body = pipe
		}
		return r, err
	}
	resp, err := c.Fetcher("interrupted", up)(context.Background(), "bytes=0-3")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _, _ = writer.Write([]byte("abc")) }()
	prefix := make([]byte, 3)
	if _, err := io.ReadFull(resp.Body, prefix); err != nil {
		t.Fatal(err)
	}
	_ = writer.CloseWithError(failure)
	_, err = io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if !errors.Is(err, failure) {
		t.Fatalf("interruption lost: %v", err)
	}
	waitIdle(t, c)
	if _, blocks := c.Stats(); blocks != 0 {
		t.Fatal("partial block persisted")
	}
	if b := readCached(t, c.Fetcher("interrupted", up), 0, 3); string(b) != "abcd" {
		t.Fatalf("retry got %q", b)
	}
}

func TestBlockCacheRejectsWrongRangeBeforePublishingBytes(t *testing.T) {
	c, err := NewBlockCache(t.TempDir(), 4, 100)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if !c.WaitIdle(time.Second) {
			t.Error("cache still downloading")
		}
	})
	up := func(context.Context, string) (*http.Response, error) {
		return &http.Response{StatusCode: 206, Header: http.Header{"Content-Range": {"bytes 0-3/12"}}, Body: io.NopCloser(strings.NewReader("WRNG"))}, nil
	}
	r, err := c.Fetcher("synthetic", up)(context.Background(), "bytes=4-7")
	if err == nil {
		b, readErr := io.ReadAll(r.Body)
		_ = r.Body.Close()
		t.Fatalf("wrong offset accepted: %q, read error %v", b, readErr)
	}
	if !c.WaitIdle(time.Second) {
		t.Fatal("download did not finish")
	}
	if _, ok := c.fileMeta("synthetic"); ok {
		t.Fatal("invalid response published file metadata")
	}
}

func TestChunkedRangeDoesNotConsumeBytesBeyondResponseRange(t *testing.T) {
	f := &quotaDrive{data: testData(12), maxRange: 4}
	cr, err := OpenChunkedRange(context.Background(), func(ctx context.Context, rh string) (*http.Response, error) {
		r, err := f.fetch(ctx, rh)
		if rh == "bytes=0-3" {
			r.Body = io.NopCloser(strings.NewReader("abcdEXTRA"))
		}
		return r, err
	}, 0, -1, 4)
	if err != nil {
		t.Fatal(err)
	}
	defer cr.Body.Close()
	b, err := io.ReadAll(cr.Body)
	want := append([]byte("abcd"), f.data[4:]...)
	if err != nil || !bytes.Equal(b, want) {
		t.Fatal(fmt.Sprintf("range overrun corrupted bytes: %x, err=%v", b, err))
	}
}

func TestChunkedRangePreservesFullBodyAndShortDeclaredRanges(t *testing.T) {
	data := testData(12)
	for _, fullBody := range []bool{false, true} {
		cr, err := OpenChunkedRange(context.Background(), func(ctx context.Context, rh string) (*http.Response, error) {
			if fullBody {
				return &http.Response{StatusCode: 200, ContentLength: int64(len(data)), Body: io.NopCloser(bytes.NewReader(data))}, nil
			}
			start, end, _, _ := parseByteRange(rh)
			end = min(end, start+1, int64(len(data)-1))
			return &http.Response{StatusCode: 206, Header: http.Header{"Content-Range": {fmt.Sprintf("bytes %d-%d/%d", start, end, len(data))}}, Body: io.NopCloser(bytes.NewReader(data[start : end+1]))}, nil
		}, 0, -1, 4)
		if err != nil {
			t.Fatal(err)
		}
		b, err := io.ReadAll(cr.Body)
		_ = cr.Body.Close()
		if err != nil || !bytes.Equal(b, data) {
			t.Fatalf("full body=%v: %x, %v", fullBody, b, err)
		}
	}
}
