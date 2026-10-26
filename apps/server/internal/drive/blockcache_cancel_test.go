package drive

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

func TestBlockCacheCanceledReaderDoesNotAbortSharedDownload(t *testing.T) {
	c, err := NewBlockCache(t.TempDir(), 8, 1024)
	if err != nil {
		t.Fatal(err)
	}
	c.freeBytes = func(string) (uint64, error) { return 1 << 40, nil }
	reader, writer := io.Pipe()
	t.Cleanup(func() {
		_ = writer.Close()
		_ = reader.Close()
		if !c.WaitIdle(3 * time.Second) {
			t.Error("shared download did not finish")
		}
	})
	var requests atomic.Int32
	fetch := c.Fetcher("shared-cancel-test", func(context.Context, string) (*http.Response, error) {
		requests.Add(1)
		return &http.Response{StatusCode: http.StatusPartialContent, Header: http.Header{"Content-Range": []string{"bytes 0-7/8"}}, Body: reader}, nil
	})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	first, err := fetch(ctx, "bytes=0-7")
	if err != nil {
		t.Fatal(err)
	}
	defer first.Body.Close()
	second, err := fetch(context.Background(), "bytes=0-7")
	if err != nil {
		t.Fatal(err)
	}
	defer second.Body.Close()
	cancel()
	if _, err := first.Body.Read(make([]byte, 8)); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled reader: %v", err)
	}
	if _, err := writer.Write([]byte("12345678")); err != nil {
		t.Fatal(err)
	}
	_ = writer.Close()
	got, err := io.ReadAll(second.Body)
	if err != nil || !bytes.Equal(got, []byte("12345678")) {
		t.Fatalf("surviving reader: %q, %v", got, err)
	}
	if requests.Load() != 1 {
		t.Fatalf("shared block fetched %d times", requests.Load())
	}
}
