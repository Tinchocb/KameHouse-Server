package drive

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MediaChunkSize is the largest range requested from Drive in one go.
//
// Browsers (<video>) and ffmpeg ask for open-ended ranges (bytes=0-) over the
// whole file; Drive answers those with 502/403 on multi-GB files, so the proxy
// splits every request into bounded chunks. Once a file's download quota is
// exhausted ("downloadQuotaExceeded"), Drive also rejects a random share of
// bounded requests regardless of size: those are retried (retryingFetch).
const MediaChunkSize int64 = 64 << 20

// RangeFetcher performs one upstream request with the given Range header.
type RangeFetcher func(ctx context.Context, rangeHeader string) (*http.Response, error)

// ChunkedRange is an open byte range [Start, End] of a Drive file of size Total,
// read through bounded upstream requests.
type ChunkedRange struct {
	Body        io.ReadCloser
	Start       int64
	End         int64 // inclusive
	Total       int64
	ContentType string
}

// ErrRangeNotSatisfiable is returned when the requested start lies past EOF.
var ErrRangeNotSatisfiable error = rangeNotSatisfiableError{}

// rangeNotSatisfiableError is the 416: the file is shorter than the reader believed (it
// was replaced in Drive), which callers report as "changed" and not as a network failure.
type rangeNotSatisfiableError struct{}

func (rangeNotSatisfiableError) Error() string          { return "drive: range not satisfiable" }
func (rangeNotSatisfiableError) DriveErrorKind() string { return ErrKindChanged }
func (rangeNotSatisfiableError) DriveStatus() int       { return http.StatusRequestedRangeNotSatisfiable }

// OpenChunkedRange opens [start, end] (end < 0 means up to EOF) fetching at most
// chunk bytes per upstream request, with the next chunk prefetched while the
// current one is read so there is no stall at chunk boundaries.
func OpenChunkedRange(ctx context.Context, fetch RangeFetcher, start, end, chunk int64) (*ChunkedRange, error) {
	if chunk <= 0 {
		chunk = MediaChunkSize
	}
	fetch = retryingFetch(fetch)
	firstEnd := start + chunk - 1
	if end >= 0 && end < firstEnd {
		firstEnd = end
	}

	resp, err := fetch(ctx, fmt.Sprintf("bytes=%d-%d", start, firstEnd))
	if err != nil {
		return nil, err
	}

	total := int64(-1)
	responseEnd := firstEnd
	if resp.StatusCode == http.StatusPartialContent {
		responseEnd, total, err = validatePartialRange(resp, start, firstEnd, -1)
		if err != nil {
			_ = resp.Body.Close()
			return nil, err
		}
	} else if resp.StatusCode == http.StatusOK && start == 0 {
		// Upstream ignored the Range header and sends the whole file.
		total = resp.ContentLength
	}
	if total < 0 {
		_ = resp.Body.Close()
		if resp.StatusCode == http.StatusRequestedRangeNotSatisfiable {
			return nil, ErrRangeNotSatisfiable
		}
		return nil, fmt.Errorf("drive: unexpected upstream response %d (Content-Range %q)", resp.StatusCode, resp.Header.Get("Content-Range"))
	}
	if start >= total {
		_ = resp.Body.Close()
		return nil, ErrRangeNotSatisfiable
	}

	effEnd := total - 1
	if end >= 0 && end < effEnd {
		effEnd = end
	}

	r := &chunkReader{
		ctx:      ctx,
		fetch:    fetch,
		chunk:    chunk,
		pos:      start,
		end:      effEnd,
		total:    total,
		cur:      resp.Body,
		curStart: start,
	}
	if resp.StatusCode == http.StatusOK {
		// Full body already streaming: no further chunks needed.
		r.single = true
		r.curEnd = effEnd
	} else {
		r.curEnd = responseEnd
		r.prefetchNext()
	}

	return &ChunkedRange{
		Body:        r,
		Start:       start,
		End:         effEnd,
		Total:       total,
		ContentType: resp.Header.Get("Content-Type"),
	}, nil
}

// Validate every response before exposing bytes: a successful HTTP request can
// still contain the wrong offset, a changed file, or an ignored Range header.
func validatePartialRange(resp *http.Response, start, stop, expectedTotal int64) (int64, int64, error) {
	v := resp.Header.Get("Content-Range")
	spec, unitOK := strings.CutPrefix(v, "bytes ")
	span, size, slashOK := strings.Cut(spec, "/")
	a, b, dashOK := strings.Cut(span, "-")
	first, e1 := strconv.ParseInt(a, 10, 64)
	last, e2 := strconv.ParseInt(b, 10, 64)
	total, e3 := strconv.ParseInt(size, 10, 64)
	if resp.StatusCode != http.StatusPartialContent || !unitOK || !slashOK || !dashOK ||
		e1 != nil || e2 != nil || e3 != nil || first != start || last < first ||
		last > stop || total <= last || expectedTotal >= 0 && total != expectedTotal {
		return 0, 0, fmt.Errorf("drive: unexpected upstream response %d (Content-Range %q) for bytes=%d-%d", resp.StatusCode, v, start, stop)
	}
	return last, total, nil
}

// chunkRetryDelays are the waits between attempts of one upstream chunk.
//
// With the quota half-exhausted Drive rejects a random share of requests: each
// extra attempt divides the failure odds, so a seek that takes a few seconds
// longer beats a playback that dies. Worst case (quota fully gone) the error
// arrives after ~6.5 s.
var chunkRetryDelays = []time.Duration{150 * time.Millisecond, 400 * time.Millisecond, time.Second, 2 * time.Second, 3 * time.Second}

// retryingFetch retries transient upstream failures (5xx, 429 and the random
// 403s Drive answers once a file's download quota is exhausted). Without it a
// single rejected chunk cut direct play or the transcoder's input mid-stream.
func retryingFetch(fetch RangeFetcher) RangeFetcher {
	return func(ctx context.Context, rangeHeader string) (*http.Response, error) {
		for attempt := 0; ; attempt++ {
			resp, err := fetch(ctx, rangeHeader)
			var se *StreamStatusError
			if err == nil || !errors.As(err, &se) || !se.Transient() || attempt >= len(chunkRetryDelays) {
				return resp, err
			}
			select {
			case <-ctx.Done():
				return nil, err
			case <-time.After(chunkRetryDelays[attempt]):
			}
		}
	}
}

type prefetched struct {
	start int64
	resp  *http.Response
	err   error
}

type chunkReader struct {
	ctx      context.Context
	fetch    RangeFetcher
	chunk    int64
	pos      int64 // next byte to deliver
	end      int64 // last byte to deliver (inclusive)
	total    int64
	cur      io.ReadCloser
	curEnd   int64 // last byte the current upstream response was asked for
	curStart int64
	single   bool

	next       chan prefetched
	nextCancel context.CancelFunc
	closed     bool
}

func (r *chunkReader) prefetchNext() {
	start := r.curEnd + 1
	if start > r.end {
		return
	}
	stop := min(start+r.chunk-1, r.end)
	ctx, cancel := context.WithCancel(r.ctx)
	ch := make(chan prefetched, 1)
	r.next, r.nextCancel = ch, cancel
	go func() {
		resp, err := r.fetch(ctx, fmt.Sprintf("bytes=%d-%d", start, stop))
		if err != nil {
			cancel()
		} else {
			resp.Body = &cancelRangeBody{ReadCloser: resp.Body, cancel: cancel}
		}
		ch <- prefetched{start: start, resp: resp, err: err}
	}()
}

type cancelRangeBody struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (b *cancelRangeBody) Close() error {
	b.cancel()
	return b.ReadCloser.Close()
}

// dropPrefetch cancels and releases a pending prefetch.
func (r *chunkReader) dropPrefetch() {
	if r.next == nil {
		return
	}
	r.nextCancel()
	ch := r.next
	r.next, r.nextCancel = nil, nil
	go func() {
		if p := <-ch; p.resp != nil {
			_ = p.resp.Body.Close()
		}
	}()
}

func (r *chunkReader) Read(p []byte) (int, error) {
	for {
		if r.closed {
			return 0, io.ErrClosedPipe
		}
		if r.pos > r.end {
			return 0, io.EOF
		}
		if left := r.end - r.pos + 1; int64(len(p)) > left {
			p = p[:left]
		}
		if r.cur != nil {
			if r.pos > r.curEnd {
				_ = r.cur.Close()
				r.cur = nil
				continue
			}
			if left := r.curEnd - r.pos + 1; int64(len(p)) > left {
				p = p[:left]
			}
			n, err := r.cur.Read(p)
			r.pos += int64(n)
			if n > 0 {
				if errors.Is(err, io.EOF) {
					err = nil
				}
				return n, err
			}
			if err == nil {
				continue
			}
			if !errors.Is(err, io.EOF) {
				return 0, err
			}
			if r.single || r.pos == r.curStart {
				return 0, io.ErrUnexpectedEOF
			}
			_ = r.cur.Close()
			r.cur = nil
			if r.pos > r.end {
				return 0, io.EOF
			}
		}
		if err := r.openNext(); err != nil {
			return 0, err
		}
	}
}

// openNext moves to the chunk starting at r.pos, using the prefetched response
// when it lines up (a short upstream read makes it unusable).
func (r *chunkReader) openNext() error {
	stop := min(r.pos+r.chunk-1, r.end)
	if r.next != nil {
		p := <-r.next
		r.next, r.nextCancel = nil, nil
		if p.err == nil && p.start == r.pos {
			last, _, err := validatePartialRange(p.resp, r.pos, stop, r.total)
			if err != nil {
				_ = p.resp.Body.Close()
				return err
			}
			r.cur, r.curEnd, r.curStart = p.resp.Body, last, r.pos
			r.prefetchNext()
			return nil
		}
		if p.resp != nil {
			_ = p.resp.Body.Close()
		}
	}
	resp, err := r.fetch(r.ctx, fmt.Sprintf("bytes=%d-%d", r.pos, stop))
	if err != nil {
		return err
	}
	last, _, err := validatePartialRange(resp, r.pos, stop, r.total)
	if err != nil {
		_ = resp.Body.Close()
		return err
	}
	r.cur, r.curEnd, r.curStart = resp.Body, last, r.pos
	r.prefetchNext()
	return nil
}

func (r *chunkReader) Close() error {
	if r.closed {
		return nil
	}
	r.closed = true
	r.dropPrefetch()
	if r.cur != nil {
		return r.cur.Close()
	}
	return nil
}
