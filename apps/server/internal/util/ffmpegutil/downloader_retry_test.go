package ffmpegutil

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

type retryTestTransport func(*http.Request) (*http.Response, error)

func (f retryTestTransport) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func TestDownloadRetryWithoutGlobalLogger(t *testing.T) {
	originalTransport, originalLogger := http.DefaultTransport, zerolog.DefaultContextLogger
	t.Cleanup(func() { http.DefaultTransport = originalTransport; zerolog.DefaultContextLogger = originalLogger })
	zerolog.DefaultContextLogger = nil
	archive := buildZip(t, map[string]string{"ffmpeg.exe": "retry-ok"})
	attempts := 0
	http.DefaultTransport = retryTestTransport(func(*http.Request) (*http.Response, error) {
		attempts++
		if attempts == 1 {
			return nil, errors.New("synthetic connection failure")
		}
		return &http.Response{StatusCode: 200, ContentLength: int64(len(archive)), Body: io.NopCloser(bytes.NewReader(archive)), Header: make(http.Header)}, nil
	})
	dir := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := downloadAndExtractURL(ctx, "http://retry.invalid/file.zip", true, sha(archive), dir, nil); err != nil {
		t.Fatal(err)
	}
	if attempts != 2 || read(t, filepath.Join(dir, "ffmpeg.exe")) != "retry-ok" {
		t.Fatal("retry did not install verified binary")
	}
}

func TestDownloadRetryCancellation(t *testing.T) {
	originalTransport := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = originalTransport })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	http.DefaultTransport = retryTestTransport(func(*http.Request) (*http.Response, error) {
		cancel()
		return nil, errors.New("synthetic connection failure")
	})
	if err := downloadAndExtractURL(ctx, "http://retry.invalid/file.zip", true, "", t.TempDir(), nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation during backoff, got %v", err)
	}
}
