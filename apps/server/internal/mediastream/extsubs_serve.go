package mediastream

import (
	"net/http"
	"strconv"

	"kamehouse/internal/mediastream/extsubs"

	"github.com/labstack/echo/v4"
)

// CacheDir devuelve la carpeta de caché del módulo ("" si aún no se inicializó).
func (r *Repository) CacheDir() string {
	r.settingsMu.RLock()
	defer r.settingsMu.RUnlock()
	return r.cacheDir
}

// externalSubtitleIndex indica si el pedido a /subtitles es por una pista externa
// (índice >= extsubs.IndexBase) y devuelve ese índice.
func externalSubtitleIndex(c echo.Context) (int, bool) {
	idx, err := strconv.Atoi(c.QueryParam("trackIndex"))
	if err != nil || idx < extsubs.IndexBase {
		return 0, false
	}
	return idx, true
}

// serveExternalSubtitle sirve un subtítulo externo (archivo suelto junto al video,
// local o de Drive) ya copiado a la caché por extsubs.Sync al armar el container.
// No depende de la extracción ffmpeg ni del container activo del cliente: la caché
// se ubica por el hash de `path`, que es la misma ruta con la que el reproductor pidió
// el stream (el texto del cliente nunca forma parte de una ruta de disco).
func (r *Repository) serveExternalSubtitle(c echo.Context, idx int) error {
	cacheDir := r.CacheDir()
	if cacheDir == "" {
		return echo.NewHTTPError(http.StatusServiceUnavailable, "module not initialized")
	}
	mediaPath := c.QueryParam("path")
	if mediaPath == "" && r.playbackManager != nil {
		clientID := c.QueryParam("clientId")
		if clientID == "" {
			clientID = c.QueryParam("clientID")
		}
		if mc, ok := r.playbackManager.clientMediaContainers.Get(clientID); ok {
			mediaPath = mc.Filepath
		}
	}
	if mediaPath == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "path query parameter is required for external subtitles")
	}
	file := extsubs.FindFile(cacheDir, mediaPath, idx)
	if file == "" {
		return echo.NewHTTPError(http.StatusNotFound, "external subtitle not found")
	}
	return c.File(file)
}
