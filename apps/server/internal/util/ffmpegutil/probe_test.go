package ffmpegutil

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	if os.Getenv("KAMEHOUSE_PROBE_HELPER") == "1" {
		if len(os.Args) < 9 || strings.Join(os.Args[1:8], " ") != "-loglevel fatal -print_format json -show_format -show_streams -show_chapters" {
			os.Exit(2)
		}
		input := os.Args[len(os.Args)-1]
		switch input {
		case "hang":
			time.Sleep(time.Minute)
		case "invalid":
			fmt.Print(`{"format":`)
		case "null-stream":
			fmt.Print(`{"format":{},"streams":[null]}`)
		case "no-format":
			fmt.Print(`{"streams":[]}`)
		case "oversize":
			fmt.Print(strings.Repeat("x", 17<<20))
		case "failure":
			fmt.Fprint(os.Stderr, "https://media.invalid/?token=TOP_SECRET")
			os.Exit(1)
		default:
			fmt.Printf(`{"format":{"filename":%q,"duration":"1.25","tags":{"major_brand":123}},"streams":[{"codec_type":"audio","tags":{"language":"jpn","title":"Japanese","rotate":"90","encoder":"fixture","creation_time":"today","location":"here"}}]}`, filepath.Base(os.Args[0]))
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func probeHelper(t *testing.T) string {
	t.Helper()
	t.Setenv("KAMEHOUSE_PROBE_HELPER", "1")
	path, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	return path
}

func TestProbeExplicitExecutableIsolatedFromDefault(t *testing.T) {
	binary := probeHelper(t)
	old := defaultProbePath.Load()
	t.Cleanup(func() { defaultProbePath.Store(old) })
	SetDefaultProbePath(filepath.Join(t.TempDir(), "missing-probe"))
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			data, err := ProbeURL(t.Context(), binary, "fixture", "-select_streams", "a")
			if err != nil {
				t.Error(err)
				return
			}
			if data.Format.Filename != filepath.Base(binary) || data.Format.DurationSeconds != 1.25 || data.Format.Tags.MajorBrand != "123" || data.Streams[0].Tags.Language != "jpn" || data.Streams[0].Tags.Title != "Japanese" || data.Streams[0].Tags.Rotate != 90 {
				t.Errorf("SDK data/tag compatibility lost: %+v", data)
			}
		})
	}
	wg.Wait()
	SetDefaultProbePath(binary)
	SetDefaultProbePath("") // Empty values retain the previous default.
	if _, err := ProbeURL(t.Context(), "", "fixture"); err != nil {
		t.Fatal(err)
	}
}

func TestProbeInvalidResponsesAndPrivateErrors(t *testing.T) {
	binary := probeHelper(t)
	for _, input := range []string{"invalid", "null-stream", "no-format", "oversize", "failure"} {
		t.Run(input, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			if _, err := ProbeURL(ctx, binary, input); err == nil || strings.Contains(err.Error(), "TOP_SECRET") {
				t.Fatalf("expected safe error, got %v", err)
			}
		})
	}
}

func TestProbeCancellationWaitsForProcess(t *testing.T) {
	binary := probeHelper(t)
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	if _, err := ProbeURL(ctx, binary, "hang"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline error, got %v", err)
	}
	if time.Since(started) > 3*time.Second {
		t.Fatal("probe did not terminate promptly")
	}
	ctx, cancel = context.WithCancel(t.Context())
	cancel()
	if _, err := ProbeURL(ctx, "missing-executable", "unused"); !errors.Is(err, context.Canceled) {
		t.Fatalf("pre-canceled probe launched: %v", err)
	}
}
