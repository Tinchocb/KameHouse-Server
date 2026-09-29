package drive

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// quotaDrive imita la cuota agotada de Drive: rechaza rangos abiertos o más
// grandes que maxRange, y puede cortar respuestas antes de tiempo (shortRead).
type quotaDrive struct {
	data      []byte
	maxRange  int64
	shortRead int64
	requests  atomic.Int32
}

func (f *quotaDrive) fetch(_ context.Context, rh string) (*http.Response, error) {
	f.requests.Add(1)
	spec := strings.TrimPrefix(rh, "bytes=")
	parts := strings.SplitN(spec, "-", 2)
	if len(parts) != 2 || parts[1] == "" {
		return nil, fmt.Errorf("403 downloadQuotaExceeded (open range %q)", rh)
	}
	a, _ := strconv.ParseInt(parts[0], 10, 64)
	b, _ := strconv.ParseInt(parts[1], 10, 64)
	size := int64(len(f.data))
	if a >= size {
		return &http.Response{StatusCode: http.StatusRequestedRangeNotSatisfiable, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	if b >= size {
		b = size - 1
	}
	if b-a+1 > f.maxRange {
		return nil, fmt.Errorf("403 downloadQuotaExceeded (range too big %q)", rh)
	}
	body := f.data[a : b+1]
	if f.shortRead > 0 && int64(len(body)) > f.shortRead {
		body = body[:f.shortRead]
	}
	h := http.Header{}
	h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", a, b, size))
	h.Set("Content-Type", "video/x-matroska")
	return &http.Response{StatusCode: http.StatusPartialContent, Header: h, Body: io.NopCloser(bytes.NewReader(body))}, nil
}

func testData(n int) []byte {
	d := make([]byte, n)
	for i := range d {
		d[i] = byte(i * 7)
	}
	return d
}

func readRange(t *testing.T, f *quotaDrive, start, end, chunk int64) (*ChunkedRange, []byte) {
	t.Helper()
	cr, err := OpenChunkedRange(context.Background(), f.fetch, start, end, chunk)
	if err != nil {
		t.Fatalf("OpenChunkedRange(%d,%d): %v", start, end, err)
	}
	got, err := io.ReadAll(cr.Body)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	_ = cr.Body.Close()
	return cr, got
}

func TestChunkedRangeOpenEndedNeverHitsDriveOpenEnded(t *testing.T) {
	f := &quotaDrive{data: testData(1000), maxRange: 100}
	cr, got := readRange(t, f, 0, -1, 100)
	if !bytes.Equal(got, f.data) || cr.Total != 1000 || cr.End != 999 {
		t.Fatalf("got %d bytes, total=%d end=%d", len(got), cr.Total, cr.End)
	}
}

func TestChunkedRangeBoundedAndMidFile(t *testing.T) {
	f := &quotaDrive{data: testData(1000), maxRange: 64}
	cr, got := readRange(t, f, 250, 777, 64)
	if !bytes.Equal(got, f.data[250:778]) || cr.Start != 250 || cr.End != 777 {
		t.Fatalf("mid range mismatch: %d bytes", len(got))
	}
	// Fin pedido más allá del archivo: se recorta al tamaño real.
	_, got = readRange(t, f, 990, 5000, 64)
	if !bytes.Equal(got, f.data[990:]) {
		t.Fatalf("tail mismatch: %d bytes", len(got))
	}
}

func TestChunkedRangeRecoversFromShortUpstreamReads(t *testing.T) {
	f := &quotaDrive{data: testData(1000), maxRange: 100, shortRead: 37}
	_, got := readRange(t, f, 0, -1, 100)
	if !bytes.Equal(got, f.data) {
		t.Fatalf("short reads corrupted the stream: %d bytes", len(got))
	}
}

func TestChunkedRangePastEOF(t *testing.T) {
	f := &quotaDrive{data: testData(100), maxRange: 50}
	if _, err := OpenChunkedRange(context.Background(), f.fetch, 100, -1, 50); err != ErrRangeNotSatisfiable {
		t.Fatalf("want ErrRangeNotSatisfiable, got %v", err)
	}
}

// Con la cuota agotada Drive rechaza al azar parte de los pedidos (403
// downloadQuotaExceeded): cada bloque se reintenta y la lectura sale completa.
func TestChunkedRangeRetriesQuotaRejections(t *testing.T) {
	old := chunkRetryDelays
	chunkRetryDelays = []time.Duration{0, 0, 0, 0, 0}
	defer func() { chunkRetryDelays = old }()

	f := &quotaDrive{data: testData(10_000), maxRange: 1 << 30}
	var calls atomic.Int32
	flaky := func(ctx context.Context, rh string) (*http.Response, error) {
		if calls.Add(1)%2 == 1 {
			return nil, &StreamStatusError{Status: http.StatusForbidden, Body: `{"reason": "downloadQuotaExceeded"}`}
		}
		return f.fetch(ctx, rh)
	}

	cr, err := OpenChunkedRange(context.Background(), flaky, 0, -1, 3000)
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(cr.Body)
	_ = cr.Body.Close()
	if err != nil || !bytes.Equal(got, f.data) {
		t.Fatalf("lectura incompleta: %d bytes, err=%v", len(got), err)
	}

	// Un 404 no es pasajero: no se reintenta.
	var notFoundCalls atomic.Int32
	_, err = OpenChunkedRange(context.Background(), func(context.Context, string) (*http.Response, error) {
		notFoundCalls.Add(1)
		return nil, &StreamStatusError{Status: http.StatusNotFound}
	}, 0, -1, 3000)
	if err == nil || notFoundCalls.Load() != 1 {
		t.Fatalf("404: err=%v pedidos=%d, se esperaba error sin reintento", err, notFoundCalls.Load())
	}
	if !errors.Is(&StreamStatusError{Status: http.StatusForbidden, Body: "downloadQuotaExceeded"}, ErrDownloadQuotaExceeded) {
		t.Fatal("el 403 de cuota debería reconocerse como ErrDownloadQuotaExceeded")
	}
}
