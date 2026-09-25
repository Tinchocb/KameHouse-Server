package handlers

import (
	"crypto/subtle"
	"errors"
	"kamehouse/internal/util"
	"net"
	"strings"

	"github.com/labstack/echo/v4"
)

func (h *Handler) isCorrectPasswordToken(token string) bool {
	if token == "" || h.App.Config == nil || h.App.Config.Server.Password == "" {
		return false
	}
	if h.App.ServerPasswordSHA256 != "" {
		if subtle.ConstantTimeCompare([]byte(token), []byte(h.App.ServerPasswordSHA256)) == 1 {
			return true
		}
		// Soportar también contraseña enviada en plano verificada mediante SHA-256 en memoria constante (Zero DoS)
		tokenSHA := util.HashSHA256Hex(token)
		if subtle.ConstantTimeCompare([]byte(tokenSHA), []byte(h.App.ServerPasswordSHA256)) == 1 {
			return true
		}
	}
	return false
}

// isAuthorized comprueba si el request cuenta con credenciales válidas
// (X-KameHouse-Token, Authorization Bearer o HMAC token con TTL en query param o header).
func (h *Handler) isAuthorized(c echo.Context) bool {
	if h.App.Config == nil || h.App.Config.Server.Password == "" {
		return true
	}

	path := c.Request().URL.Path

	// 0. Lectura interna de Drive (ffprobe/ffmpeg por loopback, ver drive_mediastream.go)
	if isDriveInternalRequest(c) {
		return true
	}

	// 1. Cabecera X-KameHouse-Token
	if token := c.Request().Header.Get("X-KameHouse-Token"); token != "" {
		if h.isCorrectPasswordToken(token) {
			return true
		}
	}

	// 2. Cabecera Authorization: Bearer <token>
	authHeader := c.Request().Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if h.isCorrectPasswordToken(token) {
			return true
		}
		hmacAuth := h.App.GetServerPasswordHMACAuth()
		if _, err := hmacAuth.ValidateToken(token, path); err == nil {
			return true
		}
	}

	// 3. Query parameter ?token=<token>
	token := c.Request().URL.Query().Get("token")
	if token != "" {
		if h.isCorrectPasswordToken(token) {
			return true
		}
		hmacAuth := h.App.GetServerPasswordHMACAuth()
		if _, err := hmacAuth.ValidateToken(token, path); err == nil {
			return true
		}
	}

	return false
}

// isLoopbackRequest comprueba si la petición HTTP se originó desde la máquina local (loopback).
func isLoopbackRequest(c echo.Context) bool {
	ipStr := c.RealIP()
	if ipStr == "" {
		ipStr = c.Request().RemoteAddr
	}
	// Si RemoteAddr contiene puerto (ej. 127.0.0.1:54321), extraer la IP
	if host, _, err := net.SplitHostPort(ipStr); err == nil {
		ipStr = host
	}
	ip := net.ParseIP(ipStr)
	return ip != nil && ip.IsLoopback()
}

// isSensitiveEndpoint comprueba si la ruta expone diagnósticos profundos, logs, o control de sistema.
func isSensitiveEndpoint(path string) bool {
	sensitivePrefixes := []string{
		"/api/v1/memory/",
		"/api/v1/log/",
		"/api/v1/logs",
		"/api/v1/filecache/",
		"/api/v1/shutdown",
		"/api/v1/db/backup",
		"/api/v1/open-in-explorer",
		"/api/v1/directory-selector",
		"/api/v1/library/local-files/dump",
		"/api/v1/library/local-files/import",
		"/api/v1/mediastream/ffmpeg/install",
	}
	for _, prefix := range sensitivePrefixes {
		if path == prefix || strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

func (h *Handler) OptionalAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path

		// Endpoints públicos que no requieren autenticación:
		// Login, Logout, Status y Callback OAuth de Google Drive (protegido por CSRF state token).
		if path == "/api/v1/auth/login" ||
			path == "/api/v1/auth/logout" ||
			path == "/api/v1/status" ||
			(path == "/api/v1/drive/callback" && c.Request().Method == "GET") {

			if path == "/api/v1/status" {
				if !h.isAuthorized(c) {
					c.Set("unauthenticated", true)
				}
			}

			return next(c)
		}

		// Si el servidor NO tiene contraseña configurada:
		if h.App.Config == nil || h.App.Config.Server.Password == "" {
			// Gatear endpoints sensibles en red local si no hay contraseña:
			// solo se permiten desde localhost / loopback.
			if isSensitiveEndpoint(path) && !isLoopbackRequest(c) {
				return h.RespondWithCodeError(c, 403, errors.New("ENDPOINT_RESTRICTED_TO_LOCALHOST"))
			}
			return next(c)
		}

		// Todos los demás endpoints (streaming, proxy, local-files, explorer,
		// directory-selector, websocket, etc.) requieren autorización válida cuando hay password configurada.
		if h.isAuthorized(c) {
			return next(c)
		}

		return h.RespondWithCodeError(c, 401, errors.New("UNAUTHENTICATED"))
	}
}
