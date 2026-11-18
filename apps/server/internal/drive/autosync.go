package drive

import "time"

const (
	// DefaultScanIntervalMinutes es cada cuánto se escanea Drive sola cuando los ajustes no fijan el intervalo.
	DefaultScanIntervalMinutes = 60
	// MinScanIntervalMinutes evita martillear la API de Drive con escaneos completos.
	MinScanIntervalMinutes = 15
	// MaxScanIntervalMinutes: como mucho un escaneo automático al día.
	MaxScanIntervalMinutes = 24 * 60
	// autoSyncRetryDelay es la espera antes de reintentar un escaneo automático que falló.
	autoSyncRetryDelay = 10 * time.Minute
)

// scanRun recuerda el último escaneo (manual o automático) para decidir cuándo toca el siguiente.
type scanRun struct {
	folderID   string
	startedAt  time.Time
	finishedAt time.Time
	failed     bool
}

// ScanInterval convierte el intervalo guardado en ajustes en una duración válida. Un valor 0
// (ajuste nunca guardado) usa el valor por defecto.
func ScanInterval(minutes int) time.Duration {
	return time.Duration(NormalizeScanIntervalMinutes(minutes)) * time.Minute
}

// NormalizeScanIntervalMinutes acota el intervalo a [MinScanIntervalMinutes, MaxScanIntervalMinutes].
func NormalizeScanIntervalMinutes(minutes int) int {
	switch {
	case minutes <= 0:
		return DefaultScanIntervalMinutes
	case minutes < MinScanIntervalMinutes:
		return MinScanIntervalMinutes
	case minutes > MaxScanIntervalMinutes:
		return MaxScanIntervalMinutes
	}
	return minutes
}

// beginRun marca el inicio de un escaneo y de qué carpeta es.
func (s *Service) beginRun(folderID string, now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastRun = scanRun{folderID: folderID, startedAt: now}
}

// endRun registra cuándo terminó el escaneo en curso y si fue con error.
func (s *Service) endRun(err error, now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastRun.finishedAt = now
	s.lastRun.failed = err != nil
}

// autoScanSchedule devuelve cuándo toca el próximo escaneo automático. ok es false cuando no hay
// nada que programar: Drive sin conectar, sin carpeta o con un escaneo en curso.
func (s *Service) autoScanSchedule(now time.Time, interval time.Duration) (next time.Time, ok bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if !s.enabled || s.client == nil || s.folderID == "" || s.isScanning {
		return time.Time{}, false
	}
	// Nunca escaneada desde el arranque, o carpeta cambiada: toca ya.
	if s.lastRun.startedAt.IsZero() || s.lastRun.folderID != s.folderID {
		return now, true
	}
	// El intervalo se cuenta desde que terminó el último escaneo: uno más largo que el intervalo
	// no encadena escaneos seguidos.
	wait := interval
	if s.lastRun.failed && wait > autoSyncRetryDelay {
		wait = autoSyncRetryDelay
	}
	base := s.lastRun.finishedAt
	if base.IsZero() {
		base = s.lastRun.startedAt
	}
	next = base.Add(wait)
	if next.Before(now) {
		next = now
	}
	return next, true
}

// AutoScanDue dice si toca un escaneo automático ahora.
func (s *Service) AutoScanDue(now time.Time, interval time.Duration) bool {
	next, ok := s.autoScanSchedule(now, interval)
	return ok && !now.Before(next)
}

// NextAutoScanAt devuelve cuándo será el próximo escaneo automático, o nil si no hay ninguno previsto.
func (s *Service) NextAutoScanAt(now time.Time, interval time.Duration) *time.Time {
	next, ok := s.autoScanSchedule(now, interval)
	if !ok {
		return nil
	}
	return &next
}
