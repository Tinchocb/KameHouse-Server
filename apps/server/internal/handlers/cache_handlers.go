package handlers

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"

	"github.com/labstack/echo/v4"
	"kamehouse/internal/database/db"
)

var (
	isThumbnailWarming atomic.Bool
	warmingCancel      context.CancelFunc
	warmingMu          sync.Mutex
	warmingTotal       atomic.Int64
	warmingProcessed   atomic.Int64
	warmingGenerated   atomic.Int64
	warmingSkipped     atomic.Int64
)

// WarmingProgress tracks active thumbnail generation progress.
type WarmingProgress struct {
	Total     int64 `json:"total"`
	Processed int64 `json:"processed"`
	Generated int64 `json:"generated"`
	Skipped   int64 `json:"skipped"`
}

// CacheStatsResponse contains runtime memory and disk metrics for all caches.
type CacheStatsResponse struct {
	Thumbnails struct {
		MemoryHits     uint64 `json:"memoryHits"`
		MemoryMisses   uint64 `json:"memoryMisses"`
		MemoryCount    int    `json:"memoryCount"`
		MemoryMaxItems int    `json:"memoryMaxItems"`
		MemoryBytes    int64  `json:"memoryBytes"`
		DiskSizeBytes  int64  `json:"diskSizeBytes"`
		DiskItemCount  int    `json:"diskItemCount"`
		DiskMaxSizeMB  int64  `json:"diskMaxSizeMB"`
	} `json:"thumbnails"`
	Videofiles struct {
		DiskSizeBytes int64 `json:"diskSizeBytes"`
	} `json:"videofiles"`
	Keyframes struct {
		DiskSizeBytes int64 `json:"diskSizeBytes"`
		DiskItemCount int   `json:"diskItemCount"`
	} `json:"keyframes"`
	Fingerprints struct {
		DiskSizeBytes int64 `json:"diskSizeBytes"`
		DiskItemCount int   `json:"diskItemCount"`
	} `json:"fingerprints"`
	Images struct {
		DiskSizeBytes int64 `json:"diskSizeBytes"`
		DiskItemCount int   `json:"diskItemCount"`
	} `json:"images"`
	TotalDiskSizeBytes int64           `json:"totalDiskSizeBytes"`
	IsWarming          bool            `json:"isWarming"`
	WarmingProgress    WarmingProgress `json:"warmingProgress"`
}

func calcDirStats(dirPath string) (int64, int) {
	var size int64
	var count int
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return 0, 0
	}
	for _, e := range entries {
		if !e.IsDir() {
			if info, err := e.Info(); err == nil {
				size += info.Size()
				count++
			}
		}
	}
	return size, count
}

func clearDirFiles(dirPath string) (int64, int) {
	var freedBytes int64
	var freedCount int
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return 0, 0
	}
	for _, e := range entries {
		if !e.IsDir() {
			fullPath := filepath.Join(dirPath, e.Name())
			if info, err := e.Info(); err == nil {
				freedBytes += info.Size()
				if err := os.Remove(fullPath); err == nil {
					freedCount++
				}
			}
		}
	}
	return freedBytes, freedCount
}

// HandleGetCacheStats returns memory and disk usage metrics for the system caches.
//
//	@summary returns cache statistics
//	@route /api/v1/system/cache/stats [GET]
//	@returns handlers.CacheStatsResponse
func (h *Handler) HandleGetCacheStats(c echo.Context) error {
	var resp CacheStatsResponse

	// 1. Thumbnail Memory Cache Stats
	if h.App.ThumbnailCache != nil {
		hits, misses, count := h.App.ThumbnailCache.Stats()
		resp.Thumbnails.MemoryHits = hits
		resp.Thumbnails.MemoryMisses = misses
		resp.Thumbnails.MemoryCount = count
		resp.Thumbnails.MemoryBytes = h.App.ThumbnailCache.BytesUsed()
	}
	resp.Thumbnails.MemoryMaxItems = h.App.Config.Cache.Thumbnails.MemoryMaxItems
	resp.Thumbnails.DiskMaxSizeMB = h.App.Config.Cache.Thumbnails.DiskMaxSizeMB

	// 2. Thumbnail Disk Cache Stats
	thumbnailDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
	resp.Thumbnails.DiskSizeBytes, resp.Thumbnails.DiskItemCount = calcDirStats(thumbnailDir)

	// 3. Mediastream Videofiles Disk Stats
	if h.App.FileCacher != nil {
		vfSize, _ := h.App.FileCacher.GetMediastreamVideoFilesTotalSize()
		resp.Videofiles.DiskSizeBytes = vfSize
	}

	// 4. Keyframes Disk Stats
	keyframeDir := filepath.Join(h.App.Config.Cache.Dir, "keyframes")
	resp.Keyframes.DiskSizeBytes, resp.Keyframes.DiskItemCount = calcDirStats(keyframeDir)

	// 5. Skipdetect Fingerprints Disk Stats
	fpDir := filepath.Join(h.App.Config.Cache.Dir, "skipdetect", "fp")
	resp.Fingerprints.DiskSizeBytes, resp.Fingerprints.DiskItemCount = calcDirStats(fpDir)

	// 6. Image-proxy Disk Stats
	imgDir := filepath.Join(h.App.Config.Cache.Dir, "images")
	resp.Images.DiskSizeBytes, resp.Images.DiskItemCount = calcDirStats(imgDir)

	resp.TotalDiskSizeBytes = resp.Thumbnails.DiskSizeBytes + resp.Videofiles.DiskSizeBytes + resp.Keyframes.DiskSizeBytes + resp.Fingerprints.DiskSizeBytes + resp.Images.DiskSizeBytes
	resp.IsWarming = isThumbnailWarming.Load()
	resp.WarmingProgress = WarmingProgress{
		Total:     warmingTotal.Load(),
		Processed: warmingProcessed.Load(),
		Generated: warmingGenerated.Load(),
		Skipped:   warmingSkipped.Load(),
	}

	return h.RespondWithData(c, resp)
}

// HandleClearSystemCache clears disk caches and memory caches according to target.
// Supports target: "thumbnails", "videofiles", "keyframes", "fingerprints", "images", "metadata", or "all" (default).
//
//	@summary clears system and thumbnail caches
//	@route /api/v1/system/cache/clear [POST]
//	@returns map[string]interface{}
func (h *Handler) HandleClearSystemCache(c echo.Context) error {
	target := c.QueryParam("target")
	if target == "" {
		target = "all"
	}

	h.App.Logger.Info().Str("target", target).Msg("cache: Manual cache purge requested")

	var freedBytes int64
	var freedCount int

	thumbnailDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
	keyframeDir := filepath.Join(h.App.Config.Cache.Dir, "keyframes")
	fpDir := filepath.Join(h.App.Config.Cache.Dir, "skipdetect", "fp")
	imgDir := filepath.Join(h.App.Config.Cache.Dir, "images")

	// 1. Thumbnails
	if target == "all" || target == "thumbnails" {
		if h.App.ThumbnailCache != nil {
			h.App.ThumbnailCache.Purge()
		}
		clearThumbnailFailures()
		fb, fc := clearDirFiles(thumbnailDir)
		freedBytes += fb
		freedCount += fc
	}

	// 2. Mediastream Videofiles
	if target == "all" || target == "videofiles" {
		if h.App.FileCacher != nil {
			vfSize, _ := h.App.FileCacher.GetMediastreamVideoFilesTotalSize()
			if err := h.App.FileCacher.ClearMediastreamVideoFiles(); err == nil {
				freedBytes += vfSize
			}
		}
	}

	// 3. Keyframes
	if target == "all" || target == "keyframes" {
		fb, fc := clearDirFiles(keyframeDir)
		freedBytes += fb
		freedCount += fc
	}

	// 4. Skipdetect Fingerprints
	if target == "all" || target == "fingerprints" {
		fb, fc := clearDirFiles(fpDir)
		freedBytes += fb
		freedCount += fc
	}

	// 4b. Image-proxy
	if target == "all" || target == "images" {
		fb, fc := clearDirFiles(imgDir)
		freedBytes += fb
		freedCount += fc
	}

	// 5. Metadata
	if target == "all" || target == "metadata" {
		if h.App.Database != nil && h.App.Database.Gorm() != nil {
			if deleted, err := db.DeleteExpiredMetadataCache(h.App.Database); err == nil && deleted > 0 {
				freedCount += int(deleted)
			}
		}
		if h.App.Metadata.Provider != nil {
			h.App.Metadata.Provider.ClearCache()
		}
		if h.App.Metadata.TMDBClient != nil {
			h.App.Metadata.TMDBClient.ClearCache()
		}
	}

	h.App.Logger.Info().
		Str("target", target).
		Int64("freedBytes", freedBytes).
		Int("freedCount", freedCount).
		Msg("cache: Cache purge complete")

	return h.RespondWithData(c, map[string]interface{}{
		"success":    true,
		"target":     target,
		"freedBytes": freedBytes,
		"freedCount": freedCount,
	})
}

// HandleWarmThumbnailCache triggers or cancels a controlled worker pool to pre-generate thumbnails for local files.
//
//	@summary pre-generates thumbnails in background or cancels running operation
//	@route /api/v1/cache/thumbnails/warm [POST]
//	@returns map[string]interface{}
func (h *Handler) HandleWarmThumbnailCache(c echo.Context) error {
	action := c.QueryParam("action")
	if action == "" {
		var req struct {
			Action string `json:"action"`
		}
		_ = c.Bind(&req)
		action = req.Action
	}

	if action == "cancel" {
		warmingMu.Lock()
		defer warmingMu.Unlock()
		if isThumbnailWarming.Load() && warmingCancel != nil {
			warmingCancel()
			h.App.Logger.Info().Msg("cache: Thumbnail warming cancellation requested")
			return h.RespondWithData(c, map[string]interface{}{
				"status":  "cancelling",
				"message": "Cancelando pre-generación de miniaturas",
			})
		}
		return h.RespondWithData(c, map[string]interface{}{
			"status":  "idle",
			"message": "No hay pre-generación en curso",
		})
	}

	warmingMu.Lock()
	if isThumbnailWarming.Swap(true) {
		warmingMu.Unlock()
		return h.RespondWithData(c, map[string]interface{}{
			"status":  "already_running",
			"message": "La pre-generación de miniaturas ya está en curso",
			"progress": WarmingProgress{
				Total:     warmingTotal.Load(),
				Processed: warmingProcessed.Load(),
				Generated: warmingGenerated.Load(),
				Skipped:   warmingSkipped.Load(),
			},
		})
	}

	ctx, cancel := context.WithCancel(context.Background())
	warmingCancel = cancel
	warmingMu.Unlock()

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		isThumbnailWarming.Store(false)
		warmingMu.Lock()
		warmingCancel = nil
		warmingMu.Unlock()
		cancel()
		return h.RespondWithError(c, fmt.Errorf("failed to retrieve local files: %w", err))
	}

	totalFiles := len(lfs)
	warmingTotal.Store(int64(totalFiles))
	warmingProcessed.Store(0)
	warmingGenerated.Store(0)
	warmingSkipped.Store(0)

	h.App.Logger.Info().Int("totalFiles", totalFiles).Msg("cache: Starting thumbnail warm-up worker pool")

	go func() {
		defer func() {
			isThumbnailWarming.Store(false)
			warmingMu.Lock()
			warmingCancel = nil
			warmingMu.Unlock()
			cancel()
		}()

		cacheDir := filepath.Join(h.App.Config.Cache.Dir, "thumbnails")
		_ = os.MkdirAll(cacheDir, 0755)

		numWorkers := 4
		if n := runtime.NumCPU(); n > 0 && n < numWorkers {
			numWorkers = n
		}

		jobs := make(chan string, 100)
		var wg sync.WaitGroup

		for w := 0; w < numWorkers; w++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for videoPath := range jobs {
					if ctx.Err() != nil {
						return
					}

					fi, err := os.Stat(videoPath)
					if err != nil {
						warmingProcessed.Add(1)
						warmingSkipped.Add(1)
						continue
					}

					cacheFile := filepath.Join(cacheDir, thumbnailHash(videoPath, fi, nil)+".jpg")

					// Fast O(1) disk existence check: skip if thumbnail already exists
					if _, err := os.Stat(cacheFile); err == nil {
						warmingProcessed.Add(1)
						warmingSkipped.Add(1)
						continue
					}

					// Cold thumbnail: generate with cancellation context
					_, err = h.EnsureThumbnailWithContext(ctx, videoPath)
					warmingProcessed.Add(1)
					if err != nil {
						warmingSkipped.Add(1)
					} else {
						warmingGenerated.Add(1)
					}
				}
			}()
		}

		for _, lf := range lfs {
			if ctx.Err() != nil {
				break
			}
			if lf != nil && lf.Path != "" {
				select {
				case jobs <- lf.Path:
				case <-ctx.Done():
					break
				}
			}
		}
		close(jobs)
		wg.Wait()

		h.App.Logger.Info().
			Int64("total", warmingTotal.Load()).
			Int64("processed", warmingProcessed.Load()).
			Int64("generated", warmingGenerated.Load()).
			Int64("skipped", warmingSkipped.Load()).
			Bool("cancelled", ctx.Err() != nil).
			Msg("cache: Thumbnail warm-up completed")
	}()

	return h.RespondWithData(c, map[string]interface{}{
		"status":     "started",
		"totalFiles": totalFiles,
	})
}
