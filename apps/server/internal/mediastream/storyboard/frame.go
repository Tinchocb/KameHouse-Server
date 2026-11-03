package storyboard

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/resourcebudget"
)

var frameSlot = make(chan struct{}, 1)

func readFrame(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if len(data) > maxImageBytes {
		return nil, errors.New("invalid frame size")
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width != Width || cfg.Height != Height {
		return nil, errors.New("invalid frame")
	}
	return data, nil
}

// EnsureFrame only decodes the GOP around the requested timestamp, not the
// entire 120-second sheet. Existing contact sheets remain usable without FFmpeg.
func EnsureFrame(ctx context.Context, cacheDir, key, input, ffmpeg string, segment int) ([]byte, error) {
	if segment < 0 || segment >= (MaxSheet+1)*Frames || len(key) != 64 {
		return nil, errors.New("invalid frame")
	}
	for _, r := range key {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f') {
			return nil, errors.New("invalid key")
		}
	}
	dir := filepath.Join(cacheDir, "storyboards")
	dest := filepath.Join(dir, key+"-frame-"+strconv.Itoa(segment)+".jpg")
	if data, err := readFrame(dest); err == nil {
		return data, nil
	}
	if data, err := readSheet(filepath.Join(dir, key+"-"+strconv.Itoa(segment/Frames)+".jpg")); err == nil {
		src, err := jpeg.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		dst := image.NewRGBA(image.Rect(0, 0, Width, Height))
		tile := segment % Frames
		draw.Draw(dst, dst.Bounds(), src, image.Pt(tile%Columns*Width, tile/Columns*Height), draw.Src)
		var out bytes.Buffer
		err = jpeg.Encode(&out, dst, &jpeg.Options{Quality: 80})
		return out.Bytes(), err
	}
	select {
	case frameSlot <- struct{}{}:
		defer func() { <-frameSlot }()
	default:
		return nil, ErrBusy
	}
	work, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	release, err := resourcebudget.Shared.Preview(work)
	if err != nil {
		return nil, err
	}
	defer release()
	if data, err := readFrame(dest); err == nil {
		return data, nil
	}
	if err = os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	if _, _, err = cache.PruneDirectory(dir, ".jpg", 30*24*time.Hour, maxDiskBytes-maxImageBytes); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp(dir, key+"-frame-*.tmp.jpg")
	if err != nil {
		return nil, err
	}
	name := tmp.Name()
	tmp.Close()
	defer os.Remove(name)
	filter := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2", Width, Height, Width, Height)
	cmd := util.NewCmdCtxLowPriority(work, ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "1", "-ss", strconv.Itoa(segment*Interval), "-i", input, "-map", "0:v:0", "-an", "-sn", "-dn", "-vf", filter, "-filter_threads", "1", "-frames:v", "1", "-threads", "1", "-q:v", "5", "-y", name)
	cmd.WaitDelay = 2 * time.Second
	if err = cmd.Run(); err != nil {
		return nil, errors.New("preview frame extraction failed")
	}
	data, err := readFrame(name)
	if err != nil {
		return nil, err
	}
	if err = work.Err(); err != nil {
		return nil, err
	}
	_ = os.Remove(dest)
	if err = os.Rename(name, dest); err != nil {
		return nil, err
	}
	return data, nil
}
