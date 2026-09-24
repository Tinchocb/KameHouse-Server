package core

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/maintenance"
	"kamehouse/internal/notifier"
	"kamehouse/internal/util/cache"
)

func (a *App) startMaintenanceScheduler() {
	scheduler := maintenance.NewScheduler(a.Logger)

	var metadataSweepFailures uint32
	const maxMetadataSweepFailures = 3

	// 1. metadata-cache-sweep
	scheduler.Add(maintenance.Job{
		Name:         "metadata-cache-sweep",
		Interval:     24 * time.Hour,
		InitialDelay: 5 * time.Minute,
		Run: func(ctx context.Context) {
			deleted, err := db.DeleteExpiredMetadataCache(a.Database)
			if err != nil {
				failures := atomic.AddUint32(&metadataSweepFailures, 1)
				a.Logger.Error().Err(err).Uint32("consecutiveFailures", failures).Msg("maintenance: Failed to sweep metadata cache")
				if failures >= maxMetadataSweepFailures {
					notifier.Global().Notify(notifier.TypeSystem, "Mantenimiento crítico",
						fmt.Sprintf("El barrido de caché de metadatos ha fallado %d veces consecutivas. La base de datos puede crecer sin control.", failures))
				}
			} else {
				atomic.StoreUint32(&metadataSweepFailures, 0)
				if deleted > 0 {
					a.Logger.Info().Int64("count", deleted).Msg("maintenance: Swept expired metadata cache entries")
				}
			}
		},
	})

	// 2. videofiles-prune
	scheduler.Add(maintenance.Job{
		Name:         "videofiles-prune",
		Interval:     24 * time.Hour,
		InitialDelay: 15 * time.Minute,
		Run: func(ctx context.Context) {
			activeHashes := a.MediastreamRepository.ActiveVideoFileHashes()
			inUse := func(hash string) bool {
				_, exists := activeHashes[hash]
				return exists
			}

			freedBytes, err := a.FileCacher.PruneMediastreamVideoFilesByAge(7*24*time.Hour, inUse)
			if err != nil {
				a.Logger.Error().Err(err).Msg("maintenance: Failed to prune videofiles cache")
			} else if freedBytes > 100*1024*1024 { // Notify only if > 100 MiB freed
				a.Logger.Info().Int64("freedBytes", freedBytes).Msg("maintenance: Pruned old videofiles cache")
				notifier.Global().Notify(notifier.TypeSystem, "Mantenimiento",
					fmt.Sprintf("Se liberaron %d MiB de caché de video.", freedBytes/(1024*1024)))
			}

			// Clean legacy per-hash mediastream_mediainfo_<hash>.cache buckets
			_ = a.FileCacher.RemoveAllBy(func(filename string) bool {
				return strings.HasPrefix(filename, "mediastream_mediainfo_")
			})
		},
	})

	// 3. log-trim
	scheduler.Add(maintenance.Job{
		Name:         "log-trim",
		Interval:     24 * time.Hour,
		InitialDelay: 30 * time.Minute,
		Run: func(ctx context.Context) {
			TrimLogEntries(a.Config.Logs.Dir, a.Logger)
		},
	})

	// 4. db-cleanup
	scheduler.Add(maintenance.Job{
		Name:         "db-cleanup",
		Interval:     7 * 24 * time.Hour,
		InitialDelay: 1 * time.Hour,
		Run: func(ctx context.Context) {
			a.Database.RunDatabaseCleanup()
			a.Database.Checkpoint()
		},
	})

	// 5. thumbnail-cache-prune
	cleanupInterval := 12 * time.Hour
	if a.Config.Cache.Thumbnails.CleanupInterval != "" {
		if d, err := time.ParseDuration(a.Config.Cache.Thumbnails.CleanupInterval); err == nil && d >= time.Minute {
			cleanupInterval = d
		}
	}

	scheduler.Add(maintenance.Job{
		Name:         "thumbnail-cache-prune",
		Interval:     cleanupInterval,
		InitialDelay: 10 * time.Minute,
		Run: func(ctx context.Context) {
			thumbnailDir := filepath.Join(a.Config.Cache.Dir, "thumbnails")
			maxAge := time.Duration(a.Config.Cache.Thumbnails.DiskTTLHours) * time.Hour
			maxSizeBytes := a.Config.Cache.Thumbnails.DiskMaxSizeMB * 1024 * 1024

			freedBytes, count, err := cache.PruneDiskCache(thumbnailDir, maxAge, maxSizeBytes)
			if err != nil {
				a.Logger.Error().Err(err).Msg("maintenance: Failed to prune thumbnail cache")
			}

			// Podar keyframes (TTL 30 días, tope 1GB)
			keyframeDir := filepath.Join(a.Config.Cache.Dir, "keyframes")
			kfFreed, kfCount, _ := cache.PruneDirectory(keyframeDir, ".json", maxAge, 1024*1024*1024)

			// Podar skipdetect audio fingerprints (TTL 30 días, tope 512MB)
			fpDir := filepath.Join(a.Config.Cache.Dir, "skipdetect", "fp")
			fpFreed, fpCount, _ := cache.PruneDirectory(fpDir, ".json", maxAge, 512*1024*1024)

			// Podar image-proxy con TTL propio (30 días, tope 1GB): desacoplado del
			// TTL de thumbnails para que desactivarlo (0) no deje images sin poda.
			const imageProxyMaxAge = 30 * 24 * time.Hour
			imgDir := filepath.Join(a.Config.Cache.Dir, "images")
			imgFreed, imgCount, _ := cache.PruneDirectory(imgDir, ".cache", imageProxyMaxAge, 1024*1024*1024)

			totalFreed := freedBytes + kfFreed + fpFreed + imgFreed
			totalCount := count + kfCount + fpCount + imgCount

			if totalFreed > 0 {
				a.Logger.Info().Int64("freedBytes", totalFreed).Int("removedCount", totalCount).Msg("maintenance: Pruned disk caches")
				if totalFreed > 100*1024*1024 { // Notify only if > 100 MiB freed
					notifier.Global().Notify(notifier.TypeSystem, "Mantenimiento",
						fmt.Sprintf("Se liberaron %d MiB en caché de disco (%d archivos eliminados).", totalFreed/(1024*1024), totalCount))
				}
			}
		},
	})

	scheduler.Start(a.shutdownCtx)
}
