package handlers

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
)

const (
	// Tras un escaneo la generación va de a una miniatura: no compite con la reproducción
	// ni con la extracción de subtítulos por CPU, disco o cuota de Drive.
	thumbnailBackgroundWorkers = 1
	// Cuántos trabajos se encolan por delante de los workers.
	thumbnailWarmQueueSize = 100
	// Mientras haya una reproducción transcodificando se espera este tiempo entre revisiones.
	thumbnailWarmBusyPoll = 5 * time.Second
	// Respiro entre miniaturas en segundo plano.
	thumbnailBackgroundGap = 150 * time.Millisecond
)

// thumbnailWarmHooks aísla del handler lo que el pool necesita, para poder probarlo sin
// ffmpeg ni Drive.
type thumbnailWarmHooks struct {
	// Generate crea (o confirma) la miniatura del archivo. generated=false: ya existía.
	Generate func(ctx context.Context, lf *dto.LocalFile) (generated bool, err error)
	// Busy indica que hay una reproducción que no hay que molestar (solo en segundo plano).
	Busy func() bool
	// OnDone recibe el resultado de cada archivo, en el orden en que terminan.
	OnDone func(generated bool, err error)
	// Gap es la pausa entre archivos de cada worker (0 = sin pausa).
	Gap time.Duration
	// BusyPoll es cada cuánto se vuelve a mirar Busy.
	BusyPoll time.Duration
}

// runThumbnailWarmPool reparte los archivos entre `workers` goroutines. Se detiene al
// cancelarse ctx. Un panic en un archivo cuenta como fallo y no mata al worker.
func runThumbnailWarmPool(ctx context.Context, files []*dto.LocalFile, workers int, hooks thumbnailWarmHooks) {
	if workers < 1 {
		workers = 1
	}
	if hooks.BusyPoll <= 0 {
		hooks.BusyPoll = thumbnailWarmBusyPoll
	}

	jobs := make(chan *dto.LocalFile, thumbnailWarmQueueSize)
	var wg sync.WaitGroup

	// waitIdle bloquea mientras haya reproducción; false si se canceló la espera.
	waitIdle := func() bool {
		for hooks.Busy != nil && hooks.Busy() {
			select {
			case <-ctx.Done():
				return false
			case <-time.After(hooks.BusyPoll):
			}
		}
		return ctx.Err() == nil
	}

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for lf := range jobs {
				if !waitIdle() {
					return
				}
				generated, err := func() (generated bool, err error) {
					// El recover va por archivo: uno que hace fallar a ffmpeg no debe
					// matar al worker (si caían todos, el productor quedaba bloqueado
					// enviando a jobs) ni al servidor.
					defer func() {
						if r := recover(); r != nil {
							err = fmt.Errorf("panic: %v", r)
						}
					}()
					return hooks.Generate(ctx, lf)
				}()
				if hooks.OnDone != nil {
					hooks.OnDone(generated, err)
				}
				if generated && hooks.Gap > 0 {
					select {
					case <-ctx.Done():
						return
					case <-time.After(hooks.Gap):
					}
				}
			}
		}()
	}

feed:
	for _, lf := range files {
		if lf == nil || lf.Path == "" {
			continue
		}
		select {
		case jobs <- lf:
		case <-ctx.Done():
			break feed
		}
	}
	close(jobs)
	wg.Wait()
}

// warmOneThumbnail deja en disco la miniatura de un archivo (local o de Drive).
func (h *Handler) warmOneThumbnail(ctx context.Context, lf *dto.LocalFile) (bool, error) {
	if strings.HasPrefix(lf.Path, "gdrive://") {
		if lf.DriveFileID == "" || h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
			return false, nil
		}
		hash := driveThumbnailHash(lf.DriveFileID, lf.FileModTime)
		cacheFile := driveThumbnailCacheFile(h.App.Config.Cache.Dir, hash)
		if _, err := os.Stat(cacheFile); err == nil {
			return false, nil
		}
		if _, err := h.fetchDriveThumbnail(hash, cacheFile, lf.DriveFileID); err != nil {
			return false, err
		}
		return true, nil
	}

	fi, err := os.Stat(lf.Path)
	if err != nil {
		return false, err
	}
	cacheFile := filepath.Join(h.App.Config.Cache.Dir, "thumbnails", thumbnailHash(lf.Path, fi, nil)+".jpg")
	// Fast O(1) disk existence check: skip if thumbnail already exists.
	if _, err := os.Stat(cacheFile); err == nil {
		return false, nil
	}
	if _, err := h.EnsureThumbnailWithContext(ctx, lf.Path); err != nil {
		return false, err
	}
	return true, nil
}

// startThumbnailWarm arranca el precalentado de miniaturas si no hay otro en curso.
// background=true: un solo worker, con pausa mientras haya una reproducción transcodificando.
// Devuelve started=false si ya había uno corriendo.
func (h *Handler) startThumbnailWarm(workers int, background bool) (started bool, total int, err error) {
	warmingMu.Lock()
	if isThumbnailWarming.Swap(true) {
		warmingMu.Unlock()
		return false, 0, nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	warmingCancel = cancel
	warmingMu.Unlock()

	finish := func() {
		isThumbnailWarming.Store(false)
		warmingMu.Lock()
		warmingCancel = nil
		warmingMu.Unlock()
		cancel()
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		finish()
		return false, 0, fmt.Errorf("failed to retrieve local files: %w", err)
	}

	total = len(lfs)
	warmingTotal.Store(int64(total))
	warmingProcessed.Store(0)
	warmingGenerated.Store(0)
	warmingSkipped.Store(0)

	h.App.Logger.Info().Int("totalFiles", total).Int("workers", workers).Bool("background", background).
		Msg("cache: Starting thumbnail warm-up worker pool")

	_ = os.MkdirAll(filepath.Join(h.App.Config.Cache.Dir, "thumbnails"), 0755)

	hooks := thumbnailWarmHooks{
		Generate: h.warmOneThumbnail,
		OnDone: func(generated bool, err error) {
			warmingProcessed.Add(1)
			switch {
			case err != nil:
				warmingSkipped.Add(1)
			case generated:
				warmingGenerated.Add(1)
			default:
				warmingSkipped.Add(1)
			}
		},
	}
	if background {
		hooks.Busy = h.transcodeActive
		hooks.Gap = thumbnailBackgroundGap
	}

	go func() {
		defer finish()
		runThumbnailWarmPool(ctx, lfs, workers, hooks)
		h.App.Logger.Info().
			Int64("total", warmingTotal.Load()).
			Int64("processed", warmingProcessed.Load()).
			Int64("generated", warmingGenerated.Load()).
			Int64("skipped", warmingSkipped.Load()).
			Bool("cancelled", ctx.Err() != nil).
			Msg("cache: Thumbnail warm-up completed")
	}()

	return true, total, nil
}

// warmThumbnailsAfterScan genera en segundo plano las miniaturas que faltan después de un
// escaneo (o de indexar Drive), para que estén listas cuando el usuario las mire. Es
// idempotente: si ya hay un precalentado en curso (manual o de un escaneo anterior) no
// arranca otro, y las que ya están en disco se saltan sin tocar ffmpeg ni Drive. Se cancela
// con la misma acción `cancel` del precalentado manual.
func (h *Handler) warmThumbnailsAfterScan(delay time.Duration) {
	if h.App == nil || h.App.Database == nil || h.App.Config == nil {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("cache: panic scheduling background thumbnail warm-up")
			}
		}()
		if delay > 0 {
			time.Sleep(delay)
		}
		if _, _, err := h.startThumbnailWarm(thumbnailBackgroundWorkers, true); err != nil {
			h.App.Logger.Warn().Err(err).Msg("cache: background thumbnail warm-up not started")
		}
	}()
}

// thumbnailWarmWorkers es la concurrencia del precalentado manual (el botón de Ajustes).
func thumbnailWarmWorkers() int {
	return min(4, max(1, runtime.NumCPU()))
}
