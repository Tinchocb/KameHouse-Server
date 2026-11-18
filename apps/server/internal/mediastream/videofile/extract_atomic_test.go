package videofile

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"kamehouse/internal/util"
)

func TestExtractionRejectsUncommittedFilesAfterCancellation(t *testing.T) {
	cache := t.TempDir()
	ext := "srt"
	info := &MediaInfo{Subtitles: []Subtitle{{Index: 0, Extension: &ext}}}
	dir := GetFileSubsCacheDir(cache, "partial")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "0.srt"), []byte("truncated"), 0600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := ExtractAttachment(ctx, "missing-ffmpeg", "missing-input", "partial", info, cache, util.NewLogger())
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("partial cache was accepted: %v", err)
	}
	if AttachmentsComplete(cache, "partial") {
		t.Fatal("cancelled output is complete")
	}
}

func TestExtractionCancellationDoesNotPublishStaging(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not available")
	}
	cache := t.TempDir()
	input := filepath.Join(t.TempDir(), "input.srt")
	var source strings.Builder
	for i := 0; i < 20000; i++ {
		fmt.Fprintf(&source, "%d\n%02d:%02d:%02d,000 --> %02d:%02d:%02d,500\nsubtitle %d\n\n", i+1, i/3600, i/60%60, i%60, i/3600, i/60%60, i%60, i)
	}
	if err := os.WriteFile(input, []byte(source.String()), 0600); err != nil {
		t.Fatal(err)
	}
	ext := "srt"
	info := &MediaInfo{Subtitles: []Subtitle{{Index: 0, Extension: &ext}}}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	err = ExtractAttachmentOpts(ctx, ffmpeg, input, "cancelled", info, cache, util.NewLogger(), ExtractOptions{OnProgress: func(float64) { cancel() }})
	if err == nil {
		t.Fatal("cancelled extraction succeeded")
	}
	if ctx.Err() != context.Canceled {
		t.Fatal("progress did not cancel extraction")
	}
	if AttachmentsComplete(cache, "cancelled") {
		t.Fatal("cancelled extraction committed")
	}
	if _, err := os.Stat(GetFileSubsCacheDir(cache, "cancelled")); !os.IsNotExist(err) {
		t.Fatalf("staging output was published: %v", err)
	}
	entries, err := os.ReadDir(filepath.Join(cache, "videofiles", "cancelled"))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".extract-") {
			t.Fatal("cancelled staging leaked")
		}
	}
}

func TestExtractionPublishesManifestAndRebuildsTruncatedOutput(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not available")
	}
	cache := t.TempDir()
	input := filepath.Join(t.TempDir(), "input.srt")
	text := "1\n00:00:00,100 --> 00:00:01,500\ncomplete subtitle\n\n"
	if err := os.WriteFile(input, []byte(text), 0600); err != nil {
		t.Fatal(err)
	}
	ext := "srt"
	info := &MediaInfo{Subtitles: []Subtitle{{Index: 0, Extension: &ext}}}
	output := filepath.Join(GetFileSubsCacheDir(cache, "hash"), "0.srt")
	if err := os.MkdirAll(filepath.Dir(output), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(output, []byte("partial"), 0600); err != nil {
		t.Fatal(err)
	}
	extract := func(binary string) error {
		return ExtractAttachment(context.Background(), binary, input, "hash", info, cache, util.NewLogger())
	}
	if err := extract(ffmpeg); err != nil {
		t.Fatal(err)
	}
	if !AttachmentsComplete(cache, "hash") {
		t.Fatal("successful extraction did not commit")
	}
	if err := extract("missing-ffmpeg"); err != nil {
		t.Fatalf("committed extraction was not reused: %v", err)
	}
	if err := os.WriteFile(output, []byte("damaged"), 0600); err != nil {
		t.Fatal(err)
	}
	if AttachmentsComplete(cache, "hash") {
		t.Fatal("truncated output matched manifest")
	}
	if err := extract(ffmpeg); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(output)
	if err != nil || !strings.Contains(string(raw), "complete subtitle") {
		t.Fatalf("output not rebuilt: %q, %v", raw, err)
	}
	entries, _ := os.ReadDir(filepath.Dir(filepath.Dir(output)))
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".extract-") {
			t.Fatal("staging directory leaked")
		}
	}
}
