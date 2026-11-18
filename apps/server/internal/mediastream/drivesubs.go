package mediastream

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"

	"github.com/labstack/echo/v4"
)

// Los subtítulos y fuentes embebidos de un archivo de Google Drive solo se pueden
// sacar leyendo el archivo entero (las pistas van intercaladas con el video). Por
// eso no se extraen solos: los dispara el usuario desde el reproductor, una sola vez
// por archivo, y quedan en la caché por hash de la ruta gdrive://.

// DriveSubtitleState es el estado de la extracción de un archivo de Drive.
type DriveSubtitleState string

const (
	DriveSubtitlesNone    DriveSubtitleState = "none"    // nunca se extrajo
	DriveSubtitlesQueued  DriveSubtitleState = "queued"  // espera su turno (una extracción a la vez)
	DriveSubtitlesRunning DriveSubtitleState = "running" // descargando y extrayendo
	DriveSubtitlesDone    DriveSubtitleState = "done"    // pistas disponibles en la caché
	DriveSubtitlesFailed  DriveSubtitleState = "error"   // falló o se canceló; se puede reintentar
)

// DriveSubtitleStatus es lo que ve la interfaz.
type DriveSubtitleStatus struct {
	State   DriveSubtitleState `json:"state"`
	Percent float64            `json:"percent"` // 0-100, aproximado (según el tiempo de media procesado)
	Error   string             `json:"error,omitempty"`
}

const (
	driveSubsDoneMarker = "subs.done"
	// driveSubsTimeout es el tope de tiempo de una extracción de Drive.
	driveSubsTimeout = 30 * time.Minute
	// DriveSubsMaxSize es el tope de tamaño de archivo para extraer (bytes).
	DriveSubsMaxSize = int64(8) << 30
)

// ErrDriveSubtitlesTooLarge: el archivo supera DriveSubsMaxSize.
var ErrDriveSubtitlesTooLarge = errors.New("drive file too large to extract subtitles")

type driveSubJob struct {
	mu     sync.Mutex
	status DriveSubtitleStatus
	cancel context.CancelFunc
}

func (j *driveSubJob) snapshot() DriveSubtitleStatus {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.status
}

func (j *driveSubJob) set(fn func(s *DriveSubtitleStatus)) {
	j.mu.Lock()
	fn(&j.status)
	j.mu.Unlock()
}

// Only the bandwidth budget is shared; job identity and cancellation are local.
var driveSubSlot = make(chan struct{}, 1)

// DriveSubtitleHash es la clave de caché de un archivo de Drive.
func DriveSubtitleHash(drivePath string) string { return util.CreateMD5(drivePath) }

// SetDriveRevision keeps subtitles and MKV window sessions separate when the
// content behind an existing Drive file ID is replaced.
func (r *Repository) SetDriveRevision(fileID, revision string) {
	if revision != "" {
		r.driveRevisions.Store(fileID, revision)
	}
}

func (r *Repository) driveSubtitleHash(path string) string {
	id := strings.SplitN(strings.TrimPrefix(path, "gdrive://"), "/", 2)[0]
	if revision, ok := r.driveRevisions.Load(id); ok {
		return util.CreateMD5(path + "|" + revision.(string))
	}
	return DriveSubtitleHash(path)
}

func driveSubsDonePath(cacheDir, hash string) string {
	return filepath.Join(cacheDir, "videofiles", hash, driveSubsDoneMarker)
}

// DriveSubtitlesExtracted indica si las pistas embebidas del archivo ya están en caché.
func (r *Repository) DriveSubtitlesExtracted(drivePath string) bool {
	cacheDir := r.CacheDir()
	if cacheDir == "" {
		return false
	}
	_, err := os.Stat(driveSubsDonePath(cacheDir, r.driveSubtitleHash(drivePath)))
	return err == nil && videofile.AttachmentsComplete(cacheDir, r.driveSubtitleHash(drivePath))
}

// TouchDriveSubtitles marca como recién usada la caché de un archivo de Drive: la
// poda de videofiles borra las carpetas sin tocar hace más de 7 días, y rehacer esta
// extracción cuesta bajar el archivo entero otra vez.
func (r *Repository) TouchDriveSubtitles(drivePath string) {
	cacheDir := r.CacheDir()
	if cacheDir == "" {
		return
	}
	now := time.Now()
	_ = os.Chtimes(filepath.Join(cacheDir, "videofiles", r.driveSubtitleHash(drivePath)), now, now)
}

// DriveSubtitleStatus devuelve el estado de la extracción de un archivo de Drive.
func (r *Repository) DriveSubtitleStatus(drivePath string) DriveSubtitleStatus {
	if v, ok := r.driveSubJobs.Load(r.driveSubtitleHash(drivePath)); ok {
		st := v.(*driveSubJob).snapshot()
		if st.State == DriveSubtitlesDone && !r.DriveSubtitlesExtracted(drivePath) {
			// The on-disk cache may have been pruned since this job finished.
			r.driveSubJobs.CompareAndDelete(r.driveSubtitleHash(drivePath), v)
			return DriveSubtitleStatus{State: DriveSubtitlesNone}
		}
		// Un estado de error viejo no debe tapar una caché que sí está completa.
		if st.State != DriveSubtitlesFailed || !r.DriveSubtitlesExtracted(drivePath) {
			return st
		}
	}
	if r.DriveSubtitlesExtracted(drivePath) {
		return DriveSubtitleStatus{State: DriveSubtitlesDone, Percent: 100}
	}
	return DriveSubtitleStatus{State: DriveSubtitlesNone}
}

// StartDriveSubtitleExtraction lanza (una sola vez por archivo) la extracción en
// segundo plano de las pistas de texto y fuentes embebidas. `inputURL` es la URL de
// loopback con la que ffmpeg lee el archivo; `sizeBytes` (si se conoce) permite
// rechazar archivos gigantes. Es idempotente: si ya está hecha o en curso, devuelve
// el estado actual.
func (r *Repository) StartDriveSubtitleExtraction(drivePath, inputURL string, mi *videofile.MediaInfo, sizeBytes int64) (DriveSubtitleStatus, error) {
	if err := r.workContext().Err(); err != nil {
		return DriveSubtitleStatus{}, err
	}
	if mi == nil {
		return DriveSubtitleStatus{}, errors.New("media info not available")
	}
	if sizeBytes > DriveSubsMaxSize {
		return DriveSubtitleStatus{}, ErrDriveSubtitlesTooLarge
	}
	settings, ok := r.GetSettings().Get()
	cacheDir := r.CacheDir()
	if !ok || settings == nil || cacheDir == "" {
		return DriveSubtitleStatus{}, errors.New("module not initialized")
	}
	hash := r.driveSubtitleHash(drivePath)

	r.driveSubJobsMu.Lock()
	defer r.driveSubJobsMu.Unlock()
	if err := r.workContext().Err(); err != nil {
		return DriveSubtitleStatus{}, err
	}
	if v, exists := r.driveSubJobs.Load(hash); exists {
		st := v.(*driveSubJob).snapshot()
		if st.State == DriveSubtitlesQueued || st.State == DriveSubtitlesRunning {
			return st, nil
		}
	}
	if r.DriveSubtitlesExtracted(drivePath) {
		return DriveSubtitleStatus{State: DriveSubtitlesDone, Percent: 100}, nil
	}
	ctx, cancel := context.WithCancel(r.workContext())
	job := &driveSubJob{status: DriveSubtitleStatus{State: DriveSubtitlesQueued}, cancel: cancel}
	r.driveSubJobs.Store(hash, job)

	miCopy := *mi
	if !r.startWork(func(context.Context) {
		r.runDriveSubtitleExtraction(ctx, job, settings.FfmpegPath, inputURL, hash, &miCopy, cacheDir)
	}) {
		cancel()
		r.driveSubJobs.Delete(hash)
		return DriveSubtitleStatus{}, context.Canceled
	}
	return job.snapshot(), nil
}

func (r *Repository) runDriveSubtitleExtraction(ctx context.Context, job *driveSubJob, ffmpegPath, inputURL, hash string, mi *videofile.MediaInfo, cacheDir string) {
	defer job.cancel()
	defer func() {
		if rec := recover(); rec != nil {
			job.set(func(s *DriveSubtitleStatus) {
				s.State = DriveSubtitlesFailed
				s.Error = fmt.Sprintf("panic: %v", rec)
			})
		}
	}()

	// Una extracción a la vez: cada una lee el archivo completo y compite por el
	// ancho de banda y la cuota de descarga de Drive.
	select {
	case driveSubSlot <- struct{}{}:
		defer func() { <-driveSubSlot }()
	case <-ctx.Done():
		job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesFailed; s.Error = "cancelled" })
		return
	}
	job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesRunning })
	if err := ctx.Err(); err != nil {
		job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesFailed; s.Error = "cancelled" })
		return
	}

	duration := float64(mi.Duration)
	err := videofile.ExtractAttachmentOpts(ctx, ffmpegPath, inputURL, hash, mi, cacheDir, r.logger, videofile.ExtractOptions{
		Timeout: driveSubsTimeout,
		OnProgress: func(outTime float64) {
			if duration <= 0 {
				return
			}
			pct := outTime / duration * 100
			if pct > 99 {
				pct = 99
			}
			job.set(func(s *DriveSubtitleStatus) { s.Percent = pct })
		},
	})
	if err != nil {
		msg := err.Error()
		if errors.Is(ctx.Err(), context.Canceled) {
			msg = "cancelled"
		}
		r.logger.Warn().Err(err).Str("hash", hash).Msg("mediastream: Drive subtitle extraction failed")
		job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesFailed; s.Error = msg })
		return
	}
	if werr := r.commitDriveSubtitleMarker(ctx, driveSubsDonePath(cacheDir, hash), []byte(time.Now().UTC().Format(time.RFC3339))); werr != nil {
		msg := werr.Error()
		if errors.Is(werr, context.Canceled) {
			msg = "cancelled"
		}
		job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesFailed; s.Error = msg })
		return
	}
	job.set(func(s *DriveSubtitleStatus) { s.State = DriveSubtitlesDone; s.Percent = 100 })
}

// CancelDriveSubtitleExtraction corta una extracción en curso o en cola.
func (r *Repository) CancelDriveSubtitleExtraction(drivePath string) {
	if v, ok := r.driveSubJobs.Load(r.driveSubtitleHash(drivePath)); ok {
		v.(*driveSubJob).cancel()
	}
}

func (r *Repository) commitDriveSubtitleMarker(ctx context.Context, path string, stamp []byte) error {
	if err := util.LockContext(ctx, &r.driveSubPublishMu); err != nil {
		return err
	}
	defer r.driveSubPublishMu.Unlock()
	previous, readErr := os.ReadFile(path)
	if readErr != nil && !os.IsNotExist(readErr) {
		return readErr
	}
	if err := util.WriteFileAtomic(path, stamp); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		if readErr == nil {
			return errors.Join(err, util.WriteFileAtomic(path, previous))
		}
		removeErr := os.Remove(path)
		if os.IsNotExist(removeErr) {
			removeErr = nil
		}
		return errors.Join(err, removeErr)
	}
	return nil
}

// subtitleMediaHash resuelve de qué medio hablan los endpoints /subtitles, /subs/pgs
// y /att: para un archivo de Drive (path gdrive://), la caché de su extracción
// diferida; para uno local, el container activo del cliente.
func (r *Repository) subtitleMediaHash(c echo.Context) (string, error) {
	if p := c.QueryParam("path"); strings.HasPrefix(p, "gdrive://") {
		switch r.DriveSubtitleStatus(p).State {
		case DriveSubtitlesDone:
			return r.driveSubtitleHash(p), nil
		case DriveSubtitlesQueued, DriveSubtitlesRunning:
			c.Response().Header().Set("Retry-After", "5")
			return "", echo.NewHTTPError(http.StatusServiceUnavailable, "subtitle extraction in progress")
		default:
			// Sin extracción completa, la lectura por ventanas ya dejó en la caché las
			// fuentes embebidas (y sirve las pistas de texto por otro camino).
			if r.ensureDriveAttachments(c.Request().Context(), p) {
				return r.driveSubtitleHash(p), nil
			}
			return "", echo.NewHTTPError(http.StatusNotFound, "subtitles of this drive file were not extracted")
		}
	}

	clientID := c.QueryParam("clientId")
	if clientID == "" {
		clientID = c.QueryParam("clientID")
	}
	if r.playbackManager == nil {
		return "", echo.NewHTTPError(http.StatusNotFound, "no file has been loaded")
	}
	mc, found := r.playbackManager.clientMediaContainers.Get(clientID)
	if !found {
		mc, found = r.playbackManager.getCurrentMediaContainer()
		if !found {
			return "", echo.NewHTTPError(http.StatusNotFound, "no file has been loaded")
		}
	}
	return mc.Hash, nil
}
