package cache

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// fileEntry holds metadata for a cached file.
type fileEntry struct {
	path    string
	size    int64
	modTime time.Time
}

// TouchDiskCache updates the access and modification times of a cached thumbnail file.
// Used for LRU eviction tracking without relying on OS-level atime.
func TouchDiskCache(cacheFile string) {
	now := time.Now()
	_ = os.Chtimes(cacheFile, now, now)
}

// PruneDiskCache cleans up the thumbnail cache directory based on TTL and maximum disk size.
// Preserved for backwards compatibility, delegates to PruneDirectory for ".jpg" files.
func PruneDiskCache(cacheDir string, maxAge time.Duration, maxSizeBytes int64) (freedBytes int64, removedCount int, err error) {
	return PruneDirectory(cacheDir, ".jpg", maxAge, maxSizeBytes)
}

// PruneDirectory cleans up any cache directory (thumbnails, keyframes, skipdetect fingerprints).
// 1. Removes stale temporary files (*.tmp*) older than 1 hour.
// 2. Removes files matching target extension whose ModTime is older than maxAge (if maxAge > 0).
// 3. If the remaining total size exceeds maxSizeBytes (if maxSizeBytes > 0),
//    evicts oldest-accessed files until the directory size reaches the low-water mark (80% of maxSizeBytes).
func PruneDirectory(cacheDir string, ext string, maxAge time.Duration, maxSizeBytes int64) (freedBytes int64, removedCount int, err error) {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, 0, nil
		}
		return 0, 0, err
	}

	now := time.Now()
	var currentTotalSize int64
	var remainingFiles []fileEntry

	// Pass 1: Stale temp files & TTL expiration
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		fullPath := filepath.Join(cacheDir, name)

		info, err := entry.Info()
		if err != nil {
			continue
		}

		size := info.Size()
		modTime := info.ModTime()

		// Clean up orphaned .tmp files older than 1 hour
		if strings.Contains(name, ".tmp") {
			if now.Sub(modTime) > time.Hour {
				if err := os.Remove(fullPath); err == nil {
					freedBytes += size
					removedCount++
				}
			}
			continue
		}

		// Filter by target extension if specified (e.g. ".jpg", ".json")
		if ext != "" && !strings.HasSuffix(name, ext) {
			continue
		}

		// TTL-based eviction
		if maxAge > 0 && now.Sub(modTime) > maxAge {
			if err := os.Remove(fullPath); err == nil {
				freedBytes += size
				removedCount++
			}
			continue
		}

		// File is within TTL; track for size-based eviction
		currentTotalSize += size
		remainingFiles = append(remainingFiles, fileEntry{
			path:    fullPath,
			size:    size,
			modTime: modTime,
		})
	}

	// Pass 2: Size-based eviction (Low-water mark at 80% of maxSizeBytes)
	if maxSizeBytes > 0 && currentTotalSize > maxSizeBytes {
		targetSize := int64(float64(maxSizeBytes) * 0.8)

		// Sort oldest accessed/modified first
		sort.Slice(remainingFiles, func(i, j int) bool {
			return remainingFiles[i].modTime.Before(remainingFiles[j].modTime)
		})

		for _, file := range remainingFiles {
			if currentTotalSize <= targetSize {
				break
			}

			if err := os.Remove(file.path); err == nil {
				freedBytes += file.size
				currentTotalSize -= file.size
				removedCount++
			}
		}
	}

	return freedBytes, removedCount, nil
}
