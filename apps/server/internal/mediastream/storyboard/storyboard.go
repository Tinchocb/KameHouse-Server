// Package storyboard stores small, versioned contact sheets independently of playback.
package storyboard

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"image/jpeg"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/resourcebudget"
)

const (
	Interval      = 10
	Columns       = 4
	Rows          = 3
	Width         = 200
	Height        = 112
	Frames        = Columns * Rows
	Span          = Interval * Frames
	MaxSheet      = 719 // bounded to 24 hours
	maxImageBytes = 4 << 20
	maxDiskBytes  = 256 << 20
)

var ErrBusy = errors.New("storyboard generation deferred for playback")
var slot = make(chan struct{}, 1)

// Key excludes transient stream URLs and credentials.
func Key(path string, size, modified int64) string {
	return fmt.Sprintf("%x", sha256.Sum256(fmt.Appendf(nil, "storyboard-v1:%s:%d:%d", path, size, modified)))
}

func readSheet(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.Size() > maxImageBytes {
		return nil, errors.New("invalid storyboard size")
	}
	cfg, err := jpeg.DecodeConfig(f)
	if err != nil || cfg.Width != Width*Columns || cfg.Height != Height*Rows {
		return nil, errors.New("invalid storyboard geometry")
	}
	return os.ReadFile(path)
}

// Ensure has no detached workers: request cancellation kills ffmpeg, releases
// admission and deletes the temporary output. Busy requests retry, never queue
// unbounded work. A completed sheet is reusable across sessions.
func Ensure(ctx context.Context, cacheDir, key, input, ffmpeg string, sheet int) ([]byte, error) {
	if len(key) != 64 || sheet < 0 || sheet > MaxSheet {
		return nil, errors.New("invalid storyboard key or sheet")
	}
	for _, r := range key {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f') {
			return nil, errors.New("invalid key")
		}
	}
	dir := filepath.Join(cacheDir, "storyboards")
	dest := filepath.Join(dir, key+"-"+strconv.Itoa(sheet)+".jpg")
	if data, err := readSheet(dest); err == nil {
		return data, nil
	}
	select {
	case slot <- struct{}{}:
		defer func() { <-slot }()
	default:
		return nil, ErrBusy
	}
	if data, err := readSheet(dest); err == nil {
		return data, nil
	}
	work, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	bg, release, err := resourcebudget.Shared.Background(work)
	if err != nil {
		return nil, ErrBusy
	}
	defer release()
	if err = os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	if _, _, err = cache.PruneDirectory(dir, ".jpg", 30*24*time.Hour, maxDiskBytes-maxImageBytes); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp(dir, key+"-*.tmp.jpg")
	if err != nil {
		return nil, err
	}
	name := tmp.Name()
	tmp.Close()
	defer os.Remove(name)
	filter := fmt.Sprintf("select='isnan(prev_selected_t)+gte(t-prev_selected_t,%d)',scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,tile=%dx%d", Interval, Width, Height, Width, Height, Columns, Rows)
	cmd := util.NewCmdCtx(bg, ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1", "-ss", strconv.Itoa(sheet*Span), "-t", strconv.Itoa(Span), "-i", input, "-an", "-sn", "-dn", "-vf", filter, "-filter_threads", "1", "-frames:v", "1", "-threads", "1", "-q:v", "5", "-y", name)
	cmd.WaitDelay = 2 * time.Second
	if err = cmd.Run(); err != nil {
		if bg.Err() != nil {
			return nil, ErrBusy
		}
		return nil, errors.New("storyboard extraction failed")
	}
	data, err := readSheet(name)
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	// Replace a corrupt cache entry, if any. Only the admitted producer writes.
	_ = os.Remove(dest)
	if err = os.Rename(name, dest); err != nil {
		return nil, err
	}
	return data, nil
}
