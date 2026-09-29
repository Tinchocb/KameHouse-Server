package handlers

import (
	"crypto/subtle"
	"errors"
	"kamehouse/internal/util"
	"net"
	"net/http"
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
		if h.isValidHMACToken(token, c.Request().Method, path) {
			return true
		}
	}

	// 3. Query parameter ?token=<token>
	token := c.Request().URL.Query().Get("token")
	if token != "" {
		if h.isCorrectPasswordToken(token) {
			return true
		}
		if h.isValidHMACToken(token, c.Request().Method, path) {
			return true
		}
	}

	return false
}

// streamTokenPathPrefixes son las rutas de reproducción a las que puede acceder
// un token de streaming (endpoint "*", ver signStreamURL).
var streamTokenPathPrefixes = []string{
	"/api/v1/mediastream/direct/play",
	"/api/v1/mediastream/transcode/",
	"/api/v1/mediastream/hls/",
	"/api/v1/mediastream/subs",
	"/api/v1/mediastream/subtitles",
	"/api/v1/mediastream/att/",
	"/api/v1/mediastream/file",
	"/api/v1/drive/play",
	"/api/v1/video-thumbnail",
	"/api/v1/music/stream",
}

// isStreamTokenRequest indica si el pedido es una lectura de una ruta de streaming.
func isStreamTokenRequest(method, path string) bool {
	if method != http.MethodGet && method != http.MethodHead {
		return false
	}
	for _, prefix := range streamTokenPathPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// isValidHMACToken valida un token HMAC contra la ruta pedida. El token de
// streaming lleva endpoint "*" y va en la URL (historial, Referer, logs): solo
// vale para leer rutas de reproducción, nunca para ajustes, apagado o borrados.
func (h *Handler) isValidHMACToken(token, method, path string) bool {
	claims, err := h.App.GetServerPasswordHMACAuth().ValidateToken(token, path)
	if err != nil {
		return false
	}
	if claims.Endpoint == "*" {
		return isStreamTokenRequest(method, path)
	}
	return true
}

// isLoopbackRequest comprueba si la petición HTTP se originó desde la máquina local (loopback).
func isLoopbackRequest(c echo.Context) bool {
	// Siempre la IP del socket: RealIP() confía en X-Forwarded-For/X-Real-IP,
	// que cualquier cliente puede falsificar para pasar por loopback.
	ipStr := c.Request().RemoteAddr
	// Si RemoteAddr contiene puerto (ej. 127.0.0.1:54321), extraer la IP
	if host, _, err := net.SplitHostPort(ipStr); err == nil {
		ipStr = host
	}
	ip := net.ParseIP(ipStr)
	return ip != nil && ip.IsLoopback()
}

// sensitiveMethodRoutes son rutas destructivas o que exportan datos privados cuyo
// GET (o método de lectura) sí debe quedar abierto a los clientes de la LAN.
var sensitiveMethodRoutes = map[string][]string{
	"/api/v1/library/local-files":       {http.MethodDelete}, // borra archivos del disco
	"/api/v1/library/empty-directories": {http.MethodDelete},
	"/api/v1/system/cache/clear":        {http.MethodPost},
	"/api/v1/metadata/cache":            {http.MethodDelete},
	"/api/v1/report":                    {http.MethodGet}, // zip con logs y ajustes
	// Configuración del servidor y credenciales: solo desde este equipo. Tema y
	// ajustes del reproductor quedan abiertos (preferencias de cada cliente).
	"/api/v1/settings":             {http.MethodPatch},
	"/api/v1/start":                {http.MethodPost},
	"/api/v1/mediastream/settings": {http.MethodPatch},
	"/api/v1/drive/callback":       {http.MethodPost},
	"/api/v1/drive/disconnect":     {http.MethodPost},
}

// lanWriteRoutes son las únicas rutas de escritura (POST/PUT/PATCH/DELETE) que
// un cliente de la LAN puede usar sin contraseña: el progreso de reproducción,
// las preferencias de cada cliente, el arranque del streaming y las consultas
// que usan POST solo por llevar cuerpo. Todo lo demás que escribe queda
// restringido a este equipo; una ruta nueva nace cerrada hasta sumarla acá.
var lanWriteRoutes = map[string]bool{
	"/api/v1/progress":                            true,
	"/api/v1/playback/sync":                       true,
	"/api/v1/continuity/item":                     true,
	"/api/v1/theme":                               true,
	"/api/v1/settings/media-player":               true,
	"/api/v1/notifications/read":                  true,
	"/api/v1/announcements":                       true,
	"/api/v1/tmdb/search":                         true,
	"/api/v1/tmdb/details":                        true,
	"/api/v1/platform/list-anime":                 true,
	"/api/v1/platform/list-recent-anime":          true,
	"/api/v1/library/anime-entry/suggestions":     true,
	"/api/v1/library/anime-entry/progress":        true,
	"/api/v1/library/anime-entry/update-progress": true,
	"/api/v1/library/anime-entry/repeat":          true,
	"/api/v1/library/anime-entry/update-repeat":   true,
	"/api/v1/library/anime-entry/silence":         true,
	"/api/v1/mediastream/request":                 true,
	"/api/v1/mediastream/preload":                 true,
	"/api/v1/mediastream/shutdown-transcode":      true,
	"/api/v1/mediastream/skip-times":              true,
}

// isRestrictedWrite indica si el pedido modifica estado y no figura entre las
// escrituras que se permiten a la LAN.
func isRestrictedWrite(method, path string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return !lanWriteRoutes[path]
	}
	return false
}

// isSensitiveEndpoint comprueba si la ruta expone diagnósticos profundos, logs, o control de sistema.
func isSensitiveEndpoint(method, path string) bool {
	for _, m := range sensitiveMethodRoutes[path] {
		if m == method {
			return true
		}
	}

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
			if (isSensitiveEndpoint(c.Request().Method, path) || isRestrictedWrite(c.Request().Method, path)) && !isLoopbackRequest(c) {
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
