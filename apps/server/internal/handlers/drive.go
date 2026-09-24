package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/library/anime"
)

// HandleDriveAuthURL returns the OAuth2 consent URL for Google Drive.
//
//	@summary returns the Google Drive authorization URL.
//	@route /api/v1/drive/auth-url [GET]
func (h *Handler) HandleDriveAuthURL(c echo.Context) error {
	clientID := c.QueryParam("clientId")
	clientSecret := c.QueryParam("clientSecret")
	redirectURI := c.QueryParam("redirectUri")

	if clientID == "" || clientSecret == "" {
		if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
			if clientID == "" {
				clientID = s.GoogleDrive.ClientID
			}
			if clientSecret == "" {
				clientSecret = s.GoogleDrive.ClientSecret
			}
		}
	}

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

	state := "kamehouse-drive"
	if h.App != nil {
		hmacAuth := h.App.GetServerPasswordHMACAuth()
		origTTL := hmacAuth.TTL()
		hmacAuth.SetTTL(15 * time.Minute)
		if s, err := hmacAuth.GenerateToken("drive-oauth"); err == nil {
			state = s
		}
		hmacAuth.SetTTL(origTTL)
	}

	authURL := drive.GetAuthURL(clientID, clientSecret, redirectURI, state)
	return h.RespondWithData(c, map[string]string{
		"url":         authURL,
		"redirectUri": redirectURI,
	})
}

// HandleDriveCallback exchanges the authorization code for OAuth2 tokens and saves them in Settings.
// Supports both browser redirect (GET) and programmatic POST.
//
//	@summary exchanges code and enables Google Drive integration.
//	@route /api/v1/drive/callback [GET, POST]
func (h *Handler) HandleDriveCallback(c echo.Context) error {
	var code, clientID, clientSecret, redirectURI string

	if c.Request().Method == http.MethodGet {
		state := c.QueryParam("state")
		if h.App != nil {
			hmacAuth := h.App.GetServerPasswordHMACAuth()
			if _, err := hmacAuth.ValidateToken(state, "drive-oauth"); err != nil && state != "kamehouse-drive" {
				h.App.Logger.Warn().Err(err).Str("state", state).Msg("drive: Invalid or expired OAuth state")
				return c.HTML(http.StatusBadRequest, "<html><body style='font-family:sans-serif;background:#121212;color:#fff;padding:2rem;'><h3>Error de seguridad</h3><p>El token de estado OAuth es inválido o ha expirado. Por favor, intenta conectar nuevamente desde Ajustes.</p></body></html>")
			}
		}

		code = c.QueryParam("code")
		if code == "" {
			errParam := c.QueryParam("error")
			if errParam == "" {
				errParam = "authorization failed"
			}
			return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error de autorización: %s</h3></body></html>", errParam))
		}
		// Read saved client credentials from settings
		if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
			clientID = s.GoogleDrive.ClientID
			clientSecret = s.GoogleDrive.ClientSecret
		}
		proto := "http"
		if c.IsTLS() || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/v1/drive/callback", proto, c.Request().Host)
	} else {
		var req struct {
			Code         string `json:"code"`
			ClientID     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
			RedirectURI  string `json:"redirectUri"`
		}
		if err := c.Bind(&req); err != nil {
			return h.RespondWithError(c, err)
		}
		code = req.Code
		clientID = req.ClientID
		clientSecret = req.ClientSecret
		redirectURI = req.RedirectURI

		if clientID == "" || clientSecret == "" {
			if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
				if clientID == "" {
					clientID = s.GoogleDrive.ClientID
				}
				if clientSecret == "" {
					clientSecret = s.GoogleDrive.ClientSecret
				}
			}
		}
	}

	if code == "" || clientID == "" || clientSecret == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("code, clientId and clientSecret are required"))
	}

	token, err := drive.ExchangeCode(c.Request().Context(), clientID, clientSecret, code, redirectURI)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("drive: Failed to exchange OAuth code")
		if c.Request().Method == http.MethodGet {
			return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error al intercambiar código: %s</h3></body></html>", err.Error()))
		}
		return h.RespondWithError(c, err)
	}

	// Update Settings in DB
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	settings.GoogleDrive.Enabled = true
	settings.GoogleDrive.ClientID = clientID
	settings.GoogleDrive.ClientSecret = clientSecret
	if token.RefreshToken != "" {
		settings.GoogleDrive.RefreshToken = token.RefreshToken
	}

	_, err = h.App.Database.UpsertSettings(settings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Refresh Drive Service
	if h.App.DriveService != nil {
		_ = h.App.DriveService.UpdateConfig(
			settings.GoogleDrive.Enabled,
			settings.GoogleDrive.ClientID,
			settings.GoogleDrive.ClientSecret,
			settings.GoogleDrive.RefreshToken,
			settings.GoogleDrive.FolderID,
			settings.GoogleDrive.FolderName,
		)
	}

	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", settings)

	if c.Request().Method == http.MethodGet {
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

	return h.RespondWithData(c, map[string]interface{}{
		"success": true,
	})
}

// HandleDriveStatus returns current Google Drive integration status.
//
//	@summary returns Google Drive connection status.
//	@route /api/v1/drive/status [GET]
func (h *Handler) HandleDriveStatus(c echo.Context) error {
	if h.App.DriveService == nil {
		return h.RespondWithData(c, drive.DriveStatus{
			Connected: false,
			Error:     "Drive service not initialized",
		})
	}

	// Count indexed drive episodes
	var driveFilesCount int64
	_ = h.App.Database.Gorm().Model(&models.LocalFile{}).Where("path LIKE 'gdrive://%'").Count(&driveFilesCount).Error

	status := h.App.DriveService.GetStatus(c.Request().Context(), int(driveFilesCount))
	return h.RespondWithData(c, status)
}

// HandleDriveDisconnect disconnects Google Drive and resets credentials.
//
//	@summary disconnects Google Drive.
//	@route /api/v1/drive/disconnect [POST]
func (h *Handler) HandleDriveDisconnect(c echo.Context) error {
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

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
	h.App.WSEventManager.SendEvent("settings", settings)

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

	ctx := c.Request().Context()

	if c.Request().Method == http.MethodHead {
		var dbFile models.LocalFile
		if err := h.App.Database.Gorm().Where("drive_file_id = ? OR path LIKE ?", fileID, "gdrive://"+fileID+"/%").First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
			res := c.Response()
			res.Header().Set("Accept-Ranges", "bytes")
			res.Header().Set("Content-Length", strconv.FormatInt(dbFile.FileSize, 10))
			mimeType := "video/x-matroska"
			ext := strings.ToLower(filepath.Ext(dbFile.Name))
			if ext == ".mp4" {
				mimeType = "video/mp4"
			} else if ext == ".webm" {
				mimeType = "video/webm"
			}
			res.Header().Set("Content-Type", mimeType)
			res.WriteHeader(http.StatusOK)
			return nil
		}

		client, err := h.App.DriveService.GetClient()
		if err == nil {
			if f, err := client.GetFile(ctx, fileID); err == nil && f != nil {
				res := c.Response()
				res.Header().Set("Accept-Ranges", "bytes")
				if f.Size > 0 {
					res.Header().Set("Content-Length", strconv.FormatInt(f.Size, 10))
				}
				if f.MimeType != "" {
					res.Header().Set("Content-Type", f.MimeType)
				}
				res.WriteHeader(http.StatusOK)
				return nil
			}
		}
	}

	rangeHeader := c.Request().Header.Get("Range")
	if rangeHeader == "" {
		rangeHeader = "bytes=0-"
	}

	resp, err := h.App.DriveService.StreamMedia(ctx, fileID, rangeHeader)
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

	buf := make([]byte, 64*1024)
	_, err = io.CopyBuffer(res.Writer, resp.Body, buf)
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
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("google drive integration is not enabled or folder not set"))
	}

	if !h.App.DriveService.TryStartScan() {
		return h.RespondWithCodeError(c, http.StatusConflict, errors.New("ya hay un escaneo de Google Drive en progreso"))
	}

	go func() {
		defer func() {
			h.App.DriveService.FinishScan()
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("drive: panic in Drive scan worker")
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		h.App.Logger.Info().Msg("drive: Starting Google Drive scan")
		res, err := h.App.DriveService.RunScan(ctx, h.App.Database.Gorm(), func(p *drive.ScanProgress) {
			h.App.WSEventManager.SendEvent("drive_scan_progress", p)
		})

		// Rows may have been written even on a partial failure: always drop the
		// server-side caches *before* notifying clients, or their refetch would
		// race the invalidation and get the stale collection back.
		db.InvalidateLocalFilesCache()
		ClearLibraryCollectionCache()
		anime.InvalidateCuratedHomeCache()

		if err != nil {
			h.App.Logger.Error().Err(err).Msg("drive: Google Drive scan failed")
			h.App.WSEventManager.SendEvent("drive_scan_completed", map[string]interface{}{
				"count": res.Indexed,
				"error": err.Error(),
			})
			return
		}
		h.App.Logger.Info().Int("indexed", res.Indexed).Int("pruned", res.Pruned).Msg("drive: Google Drive scan completed")

		h.App.WSEventManager.SendEvent("drive_scan_completed", map[string]interface{}{
			"count":  res.Indexed,
			"pruned": res.Pruned,
		})
		h.App.WSEventManager.SendEvent("library_updated", map[string]interface{}{
			"source": "google_drive",
			"count":  res.Indexed,
		})
	}()

	return h.RespondWithData(c, map[string]interface{}{
		"started": true,
	})
}
