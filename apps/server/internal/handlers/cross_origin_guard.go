package handlers

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"
)

// El CORS solo impide que una página ajena LEA la respuesta; el navegador igual
// envía los pedidos "simples" (un POST sin cuerpo, por ejemplo) y el servidor los
// ejecuta. Sin esta guarda, cualquier sitio abierto en el navegador podría
// disparar /shutdown, /drive/disconnect o un escaneo contra localhost, y un
// dominio con DNS rebinding hacerlo pasar por mismo origen.

// crossOriginWriteGuard rechaza con 403 las escrituras (POST/PUT/PATCH/DELETE)
// que un navegador origina desde un sitio no confiable. Deja pasar:
//   - pedidos sin Origin (sidecar, curl, apps nativas: no son páginas web);
//   - orígenes de la lista permitida (los mismos que acepta el CORS);
//   - orígenes de loopback (cualquier puerto) desde una conexión de loopback,
//     p. ej. un servidor de desarrollo en otro puerto;
//   - el mismo origen del Host, si ese host es una IP o un nombre local: así los
//     clientes de la LAN funcionan sin configurar nada, y un nombre público que
//     resuelva a este equipo (rebinding) no califica.
func crossOriginWriteGuard(allowedOrigins []string) echo.MiddlewareFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[strings.ToLower(strings.TrimRight(o, "/"))] = true
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			r := c.Request()
			if !isWriteMethod(r.Method) {
				return next(c)
			}
			origin := r.Header.Get("Origin")
			if origin == "" || isTrustedWriteOrigin(origin, r, allowed) {
				return next(c)
			}
			return echo.NewHTTPError(http.StatusForbidden, "CROSS_ORIGIN_WRITE_BLOCKED")
		}
	}
}

func isWriteMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

func isTrustedWriteOrigin(origin string, r *http.Request, allowed map[string]bool) bool {
	if allowed[strings.ToLower(strings.TrimRight(origin, "/"))] {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return false // incluye "null" (páginas sandbox o file://)
	}
	host := strings.ToLower(u.Hostname())

	if isLoopbackName(host) && remoteIsLoopback(r) {
		return true
	}
	return strings.EqualFold(u.Host, r.Host) && isLocalHostName(host)
}

func isLoopbackName(host string) bool {
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// isLocalHostName: una IP o un nombre que solo se resuelve en la red local.
func isLocalHostName(host string) bool {
	if net.ParseIP(host) != nil {
		return true
	}
	return host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local")
}

func remoteIsLoopback(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
