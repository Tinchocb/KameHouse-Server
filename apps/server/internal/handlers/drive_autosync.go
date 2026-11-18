package handlers

import (
	"errors"
	"time"

	"kamehouse/internal/drive"
	"kamehouse/internal/util"
)

const (
	// driveAutoSyncFirstCheck deja que la app termine de arrancar antes del primer chequeo.
	driveAutoSyncFirstCheck = 45 * time.Second
	// driveAutoSyncEvery es cada cuánto se revisa si toca escanear. El intervalo de escaneo
	// (ajustes) suele ser más largo; cada revisión solo mira ajustes y estado en memoria.
	driveAutoSyncEvery = time.Minute
)

// startDriveAutoSync arranca una única vez el bucle que escanea Drive sola: al arrancar la app,
// al cambiar de carpeta, al reintentar tras un fallo y cada intervalo configurado.
func (h *Handler) startDriveAutoSync() {
	h.driveAutoSyncOnce.Do(func() {
		h.App.StartBackground(func() {
			defer util.HandlePanicInModuleThen("handlers/driveAutoSync", func() {})
			shutdown := h.App.ShutdownCtx().Done()

			first := time.NewTimer(driveAutoSyncFirstCheck)
			defer first.Stop()
			select {
			case <-first.C:
			case <-shutdown:
				return
			}

			ticker := time.NewTicker(driveAutoSyncEvery)
			defer ticker.Stop()
			for {
				h.driveAutoSyncTick()
				select {
				case <-ticker.C:
				case <-shutdown:
					return
				}
			}
		})
	})
}

// driveAutoSyncTick escanea Drive si los ajustes y el estado del servicio lo piden.
func (h *Handler) driveAutoSyncTick() {
	if h.App.DriveService == nil {
		return
	}
	settings, err := h.App.Database.GetSettings()
	if err != nil || settings == nil || settings.GoogleDrive.DisableAutoSync || settings.Library.DisableCloudSource {
		// Con Drive pausado como origen (Biblioteca > "Usar Google Drive") no se gasta cuota en escanearlo.
		return
	}
	interval := drive.ScanInterval(settings.GoogleDrive.ScanIntervalMinutes)
	if !h.App.DriveService.AutoScanDue(time.Now(), interval) {
		return
	}
	err = h.startDriveScan(true)
	switch {
	case err == nil:
		h.App.Logger.Info().Msg("drive: escaneo automático iniciado")
	case errors.Is(err, errDriveScanRunning):
		// Ya hay un escaneo en curso: el siguiente chequeo volverá a mirarlo.
	default:
		h.App.Logger.Warn().Err(err).Msg("drive: no se pudo iniciar el escaneo automático")
	}
}
