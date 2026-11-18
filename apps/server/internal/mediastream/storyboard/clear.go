package storyboard

import (
	"context"
	"errors"
	"os"
	"path/filepath"
)

// Clear joins both kinds of producer before deleting their committed output.
// Requests admitted after it releases the slots may generate fresh previews.
func Clear(ctx context.Context, cacheDir string) (int64, int, error) {
	if err := ctx.Err(); err != nil {
		return 0, 0, err
	}
	select {
	case slot <- struct{}{}:
		defer func() { <-slot }()
	case <-ctx.Done():
		return 0, 0, ctx.Err()
	}
	select {
	case frameSlot <- struct{}{}:
		defer func() { <-frameSlot }()
	case <-ctx.Done():
		return 0, 0, ctx.Err()
	}
	dir := filepath.Join(cacheDir, "storyboards")
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, err
	}
	var bytes int64
	var count int
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return bytes, count, err
		}
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return bytes, count, err
		}
		if err := os.Remove(filepath.Join(dir, entry.Name())); err != nil {
			return bytes, count, err
		}
		bytes += info.Size()
		count++
	}
	return bytes, count, nil
}
