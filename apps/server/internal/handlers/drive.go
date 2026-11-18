package handlers

import (
	"context"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
)

// HandleDriveAuthURL returns the OAuth2 consent URL for Google Drive.
//
//	@summary returns the Google Drive authorization URL.
//	@route /api/v1/drive/auth-url [GET]
func (h *Handler) HandleDriveAuthURL(c echo.Context) error {
	clientID := c.QueryParam("clientId")
	clientSecret := c.QueryParam("clientSecret")
	if models.IsMaskedSecret(clientSecret) {
		clientSecret = ""
	}
	redirectURI := c.QueryParam("redirectUri")

	configured, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if configured == nil {
		return echo.NewHTTPError(http.StatusBadRequest, "configure Google Drive credentials before connecting")
	}
	if (clientID != "" && clientID != configured.GoogleDrive.ClientID) || (clientSecret != "" && clientSecret != configured.GoogleDrive.ClientSecret) {
		return echo.NewHTTPError(http.StatusBadRequest, "save Google Drive credentials in settings before connecting")
	}
	clientID, clientSecret = configured.GoogleDrive.ClientID, configured.GoogleDrive.ClientSecret

	if redirectURI == "" {
		proto := "http"
		if c.IsTLS() || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/v1/drive/callback", proto, c.Request().Host)
	}

	if clientID == "" || clientSecret == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("clientId and clientSecret are required to generate auth url"))
	}

	// An unpredictable, single-use state belongs only to this OAuth attempt.
	// Streaming HMAC tokens are never accepted as OAuth state.
	state := uuid.NewString()
	h.driveOAuthMu.Lock()
	if h.driveOAuthStates == nil {
		h.driveOAuthStates = make(map[string]driveOAuthAttempt)
	}
	for key, attempt := range h.driveOAuthStates {
		if time.Now().After(attempt.expiresAt) {
			delete(h.driveOAuthStates, key)
		}
	}
	if len(h.driveOAuthStates) >= 100 {
		h.driveOAuthMu.Unlock()
		return echo.NewHTTPError(http.StatusTooManyRequests, "too many pending OAuth attempts")
	}
	h.driveOAuthStates[state] = driveOAuthAttempt{expiresAt: time.Now().Add(15 * time.Minute), redirectURI: redirectURI, clientID: clientID, clientSecret: clientSecret}
	h.driveOAuthMu.Unlock()

	authURL := drive.GetAuthURL(clientID, clientSecret, redirectURI, state)
	return h.RespondWithData(c, map[string]string{
		"url":         authURL,
		"redirectUri": redirectURI,
	})
}

// HandleDriveCallback exchanges the authorization code for OAuth2 tokens and saves them in Settings.
// Es el redirect del navegador (GET) con el que Google cierra la autorización.
//
//	@summary exchanges code and enables Google Drive integration.
//	@route /api/v1/drive/callback [GET]
func (h *Handler) HandleDriveCallback(c echo.Context) error {
	state := c.QueryParam("state")
	h.driveOAuthMu.Lock()
	attempt, valid := h.driveOAuthStates[state]
	delete(h.driveOAuthStates, state)
	h.driveOAuthMu.Unlock()
	if !valid || time.Now().After(attempt.expiresAt) {
		h.App.Logger.Warn().Msg("drive: Invalid, reused or expired OAuth state")
		return c.HTML(http.StatusBadRequest, "<html><body style='font-family:sans-serif;background:#121212;color:#fff;padding:2rem;'><h3>Error de seguridad</h3><p>El token de estado OAuth es inválido o ha expirado. Por favor, intenta conectar nuevamente desde Ajustes.</p></body></html>")
	}

	code := c.QueryParam("code")
	if code == "" {
		errParam := c.QueryParam("error")
		if errParam == "" {
			errParam = "authorization failed"
		}
		return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error de autorización: %s</h3></body></html>", html.EscapeString(errParam)))
	}
	clientID, clientSecret, redirectURI := attempt.clientID, attempt.clientSecret, attempt.redirectURI
	current, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if current == nil || current.GoogleDrive.ClientID != clientID || current.GoogleDrive.ClientSecret != clientSecret {
		return echo.NewHTTPError(http.StatusConflict, "Google Drive credentials changed; start the connection again")
	}

	if clientID == "" || clientSecret == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("code, clientId and clientSecret are required"))
	}

	token, err := drive.ExchangeCode(c.Request().Context(), clientID, clientSecret, code, redirectURI)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("drive: Failed to exchange OAuth code")
		return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error al intercambiar código: %s</h3></body></html>", html.EscapeString(err.Error())))
	}

	// Update Settings in DB
	cached, err := h.App.Database.GetStoredSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	// Copia: mutar el puntero cacheado dejaba cambios sin guardar si el upsert fallaba.
	updated := *cached
	settings := &updated

	settings.GoogleDrive.Enabled = true
	if token.RefreshToken != "" {
		settings.GoogleDrive.RefreshToken = token.RefreshToken
	}

	_, err = h.App.Database.UpsertSettings(settings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.applyDriveConfig()

	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", settings.Redacted())

	return c.HTML(http.StatusOK, `
			<!DOCTYPE html>
			<html>
			<head><title>KameHouse - Google Drive Conectado</title></head>
			<body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; background: #121212; color: #fff;">
				<h2 style="color: #4ade80;">¡Google Drive conectado exitosamente!</h2>
				<p>La cuenta ha sido vinculada con KameHouse. Ya puedes cerrar esta pestaña.</p>
				<script>
					if (window.opener) {
						window.opener.postMessage({ type: 'KAMEHOUSE_DRIVE_CONNECTED' }, '*');
						setTimeout(function() { window.close(); }, 1200);
					}
				</script>
			</body>
			</html>
		`)
}

// HandleDriveStatus returns current Google Drive integration status.
//
//	@summary returns Google Drive connection status.
//	@route /api/v1/drive/status [GET]
func (h *Handler) HandleDriveStatus(c echo.Context) error {
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	configured := settings != nil && strings.TrimSpace(settings.GoogleDrive.ClientID) != "" && strings.TrimSpace(settings.GoogleDrive.ClientSecret) != ""
	if h.App.DriveService == nil {
		return h.RespondWithData(c, drive.DriveStatus{
			OAuthConfigured: configured,
			Connected:       false,
			Error:           "Drive service not initialized",
		})
	}

	// Count indexed drive episodes
	var driveFilesCount int64
	_ = h.App.Database.Gorm().Model(&models.LocalFile{}).Where("path LIKE 'gdrive://%'").Count(&driveFilesCount).Error

	status := h.App.DriveService.GetStatus(c.Request().Context(), int(driveFilesCount))
	status.OAuthConfigured = configured
	interval := drive.ScanInterval(0)
	if settings != nil {
		interval = drive.ScanInterval(settings.GoogleDrive.ScanIntervalMinutes)
		status.AutoSync = !settings.GoogleDrive.DisableAutoSync
	}
	status.ScanIntervalMinutes = int(interval / time.Minute)
	if status.AutoSync {
		status.NextScanAt = h.App.DriveService.NextAutoScanAt(time.Now(), interval)
	}
	return h.RespondWithData(c, status)
}

// HandleDriveDisconnect disconnects Google Drive and resets credentials.
//
//	@summary disconnects Google Drive.
//	@route /api/v1/drive/disconnect [POST]
func (h *Handler) HandleDriveDisconnect(c echo.Context) error {
	cached, err := h.App.Database.GetStoredSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	updated := *cached // copia: no mutar el puntero cacheado y compartido
	settings := &updated

	settings.GoogleDrive.Enabled = false
	settings.GoogleDrive.RefreshToken = ""
	_, err = h.App.Database.UpsertSettings(settings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if h.App.DriveService != nil {
		_ = h.App.DriveService.UpdateConfig(false, "", "", "", "", "")
	}

	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", settings.Redacted())

	return h.RespondWithData(c, map[string]interface{}{
		"success": true,
	})
}

// HandleDrivePlay streams a video file directly from Google Drive using HTTP Range forwarding.
//
//	@summary proxies media bytes from Google Drive with Range header support.
//	@route /api/v1/drive/play [GET, HEAD]
func (h *Handler) HandleDrivePlay(c echo.Context) error {
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("google drive integration is not active"))
	}

	fileID := c.QueryParam("fileId")
	if fileID == "" {
		rawPath := c.QueryParam("path")
		if strings.HasPrefix(rawPath, "gdrive://") {
			clean := strings.TrimPrefix(rawPath, "gdrive://")
			parts := strings.Split(clean, "/")
			if len(parts) > 0 {
				fileID = parts[0]
			}
		}
	}

	if fileID == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("fileId or valid gdrive path is required"))
	}
	// Sin esto un fileId con "/", "?" o "%" alteraba la URL de googleapis y
	// el LIKE de abajo.
	if !drive.ValidFileID(fileID) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid fileId"))
	}

	revision, revisionErr := h.refreshDriveRevision(c.Request().Context(), fileID)
	if revisionErr != nil {
		return h.RespondWithCodeError(c, http.StatusBadGateway, errors.New("could not verify the current Drive file revision"))
	}
	if expected := c.QueryParam("revision"); expected != "" && expected != revision {
		return h.RespondWithCodeError(c, http.StatusConflict, errors.New("the Drive file changed; reopen playback"))
	}
	ctx := c.Request().Context()

	if c.Request().Method == http.MethodHead {
		f, err := h.currentDriveFile(ctx, fileID)
		if err != nil {
			return h.RespondWithCodeError(c, http.StatusBadGateway, err)
		}
		res := c.Response()
		res.Header().Set("Accept-Ranges", "bytes")
		res.Header().Set("Content-Length", strconv.FormatInt(f.Size, 10))
		if f.MimeType != "" {
			res.Header().Set("Content-Type", f.MimeType)
		}
		return c.NoContent(http.StatusOK)
	}

	rangeHeader := c.Request().Header.Get("Range")
	start, end, hasRange, simple := parseSingleByteRange(rangeHeader)
	if !simple {
		// Suffix (bytes=-N) or multi-range: rare, forwarded untouched.
		return h.forwardDriveRange(c, fileID, rangeHeader)
	}

	// Never ask Drive for an open-ended range: with the file's download quota
	// exhausted it answers 403 downloadQuotaExceeded to bytes=0- (what <video>
	// and ffmpeg send first) while bounded ranges keep working. Direct play and
	// transcode of that file both died with "Format error"/502.
	var fetch drive.RangeFetcher = func(ctx context.Context, rh string) (*http.Response, error) {
		return h.App.DriveService.StreamMedia(ctx, fileID, rh)
	}
	// Caché de bloques en disco: cada byte se baja de Drive una sola vez
	// (reanudar, volver atrás, el transcoder y los Cues leen del disco).
	if cache := h.driveBlockCache(); cache != nil {
		h.validateDriveCache(cache, fileID)
		if c.QueryParam("preview") == "1" {
			fetch = cache.FetcherWithoutReadAhead(fileID, fetch)
		} else {
			fetch = cache.Fetcher(fileID, fetch)
		}
	}
	cr, err := drive.OpenChunkedRange(ctx, fetch, start, end, drive.MediaChunkSize)
	if errors.Is(err, drive.ErrRangeNotSatisfiable) {
		return h.RespondWithCodeError(c, http.StatusRequestedRangeNotSatisfiable, err)
	}
	if errors.Is(err, drive.ErrDownloadQuotaExceeded) {
		// Límite diario de Google por archivo: no es un fallo nuestro ni de red.
		h.App.Logger.Warn().Str("fileId", fileID).Msg("drive: Download quota exceeded for file")
		c.Response().Header().Set("Retry-After", "3600")
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable,
			errors.New("Google Drive limitó por hoy las descargas de este archivo (cuota agotada). Suele liberarse en unas horas"))
	}
	if err != nil {
		h.App.Logger.Error().Err(err).Str("fileId", fileID).Msg("drive: Failed to stream media from Drive")
		return h.RespondWithCodeError(c, http.StatusBadGateway, err)
	}
	defer cr.Body.Close()

	res := c.Response()
	res.Header().Set("Accept-Ranges", "bytes")
	if cr.ContentType != "" {
		res.Header().Set("Content-Type", cr.ContentType)
	}
	res.Header().Set("Content-Length", strconv.FormatInt(cr.End-cr.Start+1, 10))
	status := http.StatusOK
	if hasRange {
		status = http.StatusPartialContent
		res.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", cr.Start, cr.End, cr.Total))
	}
	res.WriteHeader(status)
	if c.Request().Method == http.MethodHead {
		return nil
	}

	bufp := driveCopyBufPool.Get().(*[]byte)
	defer driveCopyBufPool.Put(bufp)
	_, err = io.CopyBuffer(res.Writer, cr.Body, *bufp)
	if err != nil && !errors.Is(err, context.Canceled) {
		h.App.Logger.Trace().Err(err).Msg("drive: Stream closed by client")
	}

	return nil
}

var (
	driveBlockCacheOnce sync.Once
	driveBlockCacheInst *drive.BlockCache
)

// driveBlockCache abre (una vez) la caché de bloques en <cache>/drive-blocks.
func (h *Handler) driveBlockCache() *drive.BlockCache {
	driveBlockCacheOnce.Do(func() {
		if h.App.Config == nil || h.App.Config.Cache.Dir == "" {
			return
		}
		// DiskMaxSizeMB llega en MB; 0 deja el valor por defecto de NewBlockCache.
		maxBytes := h.App.Config.Cache.Drive.DiskMaxSizeMB << 20
		c, err := drive.NewBlockCache(filepath.Join(h.App.Config.Cache.Dir, "drive-blocks"), 0, maxBytes)
		if err != nil {
			h.App.Logger.Warn().Err(err).Msg("drive: Block cache disabled")
			return
		}
		driveBlockCacheInst = c
	})
	return driveBlockCacheInst
}

// validateDriveCache refreshes the immutable block namespace before a reader
// opens cached data. Metadata lookups are deduplicated with a short TTL.
func (h *Handler) validateDriveCache(cache *drive.BlockCache, fileID string) {
	f, err := h.currentDriveFile(context.Background(), fileID)
	if err == nil {
		cache.ValidateRevision(fileID, f.Size, driveFileRevision(f))
	}
}

// parseSingleByteRange parses "bytes=S-E" / "bytes=S-" (end -1). An empty header
// is the whole file (hasRange=false). simple=false for suffix or multi-ranges.
func parseSingleByteRange(h string) (start, end int64, hasRange, simple bool) {
	if h == "" {
		return 0, -1, false, true
	}
	spec, ok := strings.CutPrefix(strings.TrimSpace(h), "bytes=")
	if !ok || strings.Contains(spec, ",") {
		return 0, 0, true, false
	}
	a, b, ok := strings.Cut(spec, "-")
	if !ok || a == "" {
		return 0, 0, true, false
	}
	start, err := strconv.ParseInt(strings.TrimSpace(a), 10, 64)
	if err != nil || start < 0 {
		return 0, 0, true, false
	}
	end = -1
	if b = strings.TrimSpace(b); b != "" {
		if end, err = strconv.ParseInt(b, 10, 64); err != nil || end < start {
			return 0, 0, true, false
		}
	}
	return start, end, true, true
}

// forwardDriveRange proxies a Range header to Drive as-is (single upstream request).
func (h *Handler) forwardDriveRange(c echo.Context, fileID, rangeHeader string) error {
	resp, err := h.App.DriveService.StreamMedia(c.Request().Context(), fileID, rangeHeader)
	if err != nil {
		h.App.Logger.Error().Err(err).Str("fileId", fileID).Msg("drive: Failed to stream media from Drive")
		return h.RespondWithCodeError(c, http.StatusBadGateway, err)
	}
	defer resp.Body.Close()

	res := c.Response()
	for _, key := range []string{"Content-Range", "Content-Length", "Content-Type", "Accept-Ranges"} {
		if val := resp.Header.Get(key); val != "" {
			res.Header().Set(key, val)
		}
	}
	if res.Header().Get("Accept-Ranges") == "" {
		res.Header().Set("Accept-Ranges", "bytes")
	}
	res.WriteHeader(resp.StatusCode)
	if c.Request().Method == http.MethodHead {
		return nil
	}

	bufp := driveCopyBufPool.Get().(*[]byte)
	defer driveCopyBufPool.Put(bufp)
	_, err = io.CopyBuffer(res.Writer, resp.Body, *bufp)
	if err != nil && !errors.Is(err, context.Canceled) {
		h.App.Logger.Trace().Err(err).Msg("drive: Stream closed by client")
	}
	return nil
}

// HandleDriveScan triggers an on-demand scan of Google Drive files.
//
//	@summary scans configured Google Drive folder and indexes anime files.
//	@route /api/v1/drive/scan [POST]
func (h *Handler) HandleDriveScan(c echo.Context) error {
	switch err := h.startDriveScan(false); {
	case err == nil:
	case errors.Is(err, errDriveNotReady):
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	case errors.Is(err, errDriveScanRunning):
		return h.RespondWithCodeError(c, http.StatusConflict, err)
	default:
		return echo.NewHTTPError(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN")
	}

	return h.RespondWithData(c, map[string]interface{}{
		"started": true,
	})
}

// startDriveScan lanza en segundo plano un escaneo de la carpeta configurada. Lo usan el botón de
// escanear, el selector de carpeta y la sincronización automática (automatic=true, sin avisos).
func (h *Handler) startDriveScan(automatic bool) error {
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return errDriveNotReady
	}

	if !h.App.DriveService.TryStartScan() {
		return errDriveScanRunning
	}

	if !h.App.StartBackground(func() {
		defer func() {
			h.App.DriveService.FinishScan()
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("drive: panic in Drive scan worker")
			}
		}()

		ctx, cancel := context.WithTimeout(h.App.ShutdownCtx(), 10*time.Minute)
		defer cancel()

		h.App.Logger.Info().Msg("drive: Starting Google Drive scan")
		res, err := h.App.DriveService.RunScan(ctx, h.App.Database.Gorm(), func(p *drive.ScanProgress) {
			h.App.WSEventManager.SendEvent("drive_scan_progress", p)
		})
		if ctx.Err() != nil {
			return
		}

		// Rows may have been written even on a partial failure: always drop the
		// server-side caches *before* notifying clients, or their refetch would
		// race the invalidation and get the stale collection back.
		db.InvalidateLocalFilesCache(h.App.Database)
		ClearLibraryCollectionCache()
		h.prewarmShelfImages(0) // series nuevas: sus fondos al disco local
		// Frames de Drive que faltan, en segundo plano y de a uno.
		h.warmThumbnailsAfterScan(2 * time.Second)

		if err != nil {
			h.App.Logger.Error().Err(err).Bool("automatic", automatic).Msg("drive: Google Drive scan failed")
			h.App.WSEventManager.SendEvent("drive_scan_completed", map[string]interface{}{
				"count": res.Indexed,
				"error": err.Error(),
				"auto":  automatic,
			})
			return
		}
		h.App.Logger.Info().Int("indexed", res.Indexed).Int("pruned", res.Pruned).Bool("automatic", automatic).Msg("drive: Google Drive scan completed")

		h.App.WSEventManager.SendEvent("drive_scan_completed", map[string]interface{}{
			"count":  res.Indexed,
			"pruned": res.Pruned,
			"auto":   automatic,
		})
		h.App.WSEventManager.SendEvent("library_updated", map[string]interface{}{
			"source": "google_drive",
			"count":  res.Indexed,
		})
	}) {
		h.App.DriveService.FinishScan()
		return errDriveShuttingDown
	}

	return nil
}

var (
	errDriveNotReady     = errors.New("google drive integration is not enabled or folder not set")
	errDriveScanRunning  = errors.New("ya hay un escaneo de Google Drive en progreso")
	errDriveShuttingDown = errors.New("SERVER_SHUTTING_DOWN")
	errDriveNotConnected = errors.New("conecta tu cuenta de Google Drive primero")
)

// applyDriveConfig reconstruye el cliente de Drive con los ajustes efectivos. Parte de GetSettings
// y no de los ajustes guardados: las credenciales provisionadas por entorno no están en la base.
func (h *Handler) applyDriveConfig() {
	if h.App.DriveService == nil {
		return
	}
	eff, err := h.App.Database.GetSettings()
	if err != nil || eff == nil {
		return
	}
	gd := eff.GoogleDrive
	if err := h.App.DriveService.UpdateConfig(gd.Enabled, gd.ClientID, gd.ClientSecret, gd.RefreshToken, gd.FolderID, gd.FolderName); err != nil {
		h.App.Logger.Warn().Err(err).Msg("drive: no se pudo aplicar la configuración de Google Drive")
	}
}

// driveCopyBufPool recicla los buffers de 64 KB del proxy de streaming de Drive.
// Con HTTP/1.1 io.CopyBuffer delega en http.response.ReadFrom (que ya usa su
// propio pool) y el buffer no se toca; con HTTP/2 o un writer envuelto sí se
// usa. Con el pool ninguno de los dos casos asigna 64 KB por petición.
// Se guarda *[]byte para que Put no asigne (SA6002).
var driveCopyBufPool = sync.Pool{
	New: func() any {
		b := make([]byte, 64*1024)
		return &b
	},
}
