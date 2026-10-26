package handlers

import (
	"context"
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/mkvsubs"

	"github.com/labstack/echo/v4"
)

// addDriveEmbeddedSubtitles expone en el container de un archivo de Drive las pistas
// embebidas que ffprobe encontró (`src`, el container sin filtrar).
//   - Si ya se extrajeron (caché por hash de la ruta gdrive://): quedan listas para
//     usar, igual que en un archivo local, junto con sus fuentes.
//   - Si no: se listan como pendientes (NeedsExtraction, sin enlace) para que el
//     reproductor ofrezca extraerlas. Extraer obliga a leer el archivo entero, por eso
//     nunca se hace sin que el usuario lo pida.
//
// `out.MediaInfo` debe ser una copia privada (publicDriveContainer ya la hace).
func (h *Handler) addDriveEmbeddedSubtitles(ctx context.Context, out *mediastream.MediaContainer, src *videofile.MediaInfo, drivePath string) {
	if out == nil || out.MediaInfo == nil || src == nil {
		return
	}
	embedded := extractableSubtitles(src.Subtitles)
	if len(embedded) == 0 {
		return
	}
	if h.App.MediastreamRepository.DriveSubtitlesExtracted(drivePath) {
		h.App.MediastreamRepository.TouchDriveSubtitles(drivePath)
		out.MediaInfo.Subtitles = appendExternalSubtitles(out.MediaInfo.Subtitles, embedded)
		out.MediaInfo.Fonts = append([]string(nil), src.Fonts...)
		return
	}
	// Lectura por ventanas: las pistas de texto de un MKV con Cues se leen de la franja
	// que se está viendo, sin bajar el archivo entero. El resto (PGS, archivos sin
	// índice) queda pendiente de la extracción completa, que el usuario dispara.
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	info := h.App.MediastreamRepository.DriveWindowSupportInfo(ctx, drivePath, embedded)
	windowed := info.Tracks
	if info.FileReason != "" {
		windowed = nil
	}
	listed := make([]videofile.Subtitle, len(embedded))
	anyProgressive := false
	for i, s := range embedded {
		s.Link = nil
		// Si Drive falló al abrir el archivo (límite de uso, red), no se sabe si sirve: no se
		// lo manda al botón "Extraer" (bajar todo) por una falla pasajera. Las pistas de texto
		// quedan como progresivas y la lectura se reintenta sola, mostrando el error.
		textTrack := !s.IsImageBased && s.Extension != nil && (*s.Extension == "srt" || *s.Extension == "ass" || *s.Extension == "ssa")
		if windowed[s.Index] || (info.ReadFailed && textTrack) {
			s.Progressive = true
			anyProgressive = true
		} else {
			s.NeedsExtraction = true
		}
		listed[i] = s
	}
	out.MediaInfo.Subtitles = appendExternalSubtitles(out.MediaInfo.Subtitles, listed)
	if anyProgressive {
		// Las fuentes ya están en la caché de adjuntos (las dejó abrir el archivo).
		out.MediaInfo.Fonts = append([]string(nil), src.Fonts...)
	}
}

// extractableSubtitles son las pistas que la extracción sabe volcar a la caché:
// texto (srt/ass/ssa/vtt) y PGS (.sup).
func extractableSubtitles(subs []videofile.Subtitle) []videofile.Subtitle {
	var out []videofile.Subtitle
	for _, s := range subs {
		if s.Extension == nil || *s.Extension == "" {
			continue
		}
		if s.IsImageBased && *s.Extension != "sup" {
			continue
		}
		out = append(out, s)
	}
	return out
}

type driveSubtitlesBody struct {
	Path string `json:"path"` // gdrive://<fileId>/<ruta>
}

// validDrivePathParam valida un path gdrive:// recibido del cliente.
func validDrivePathParam(p string) (fileID, fileName string, ok bool) {
	if !strings.HasPrefix(p, "gdrive://") {
		return "", "", false
	}
	fileID, fileName = parseDrivePath(p)
	if !drive.ValidFileID(fileID) {
		return "", "", false
	}
	return fileID, fileName, true
}

// driveSubtitlesStatusResponse suma al estado las fuentes embebidas, que el
// reproductor necesita para JASSUB una vez terminada la extracción.
type driveSubtitlesStatusResponse struct {
	mediastream.DriveSubtitleStatus
	Fonts []string `json:"fonts,omitempty"`
}

// HandleDriveSubtitlesStatus informa el estado de la extracción de subtítulos
// embebidos de un archivo de Drive.
//
//	@summary returns the embedded-subtitle extraction status of a Google Drive file.
//	@route /api/v1/drive/subtitles/status [GET]
func (h *Handler) HandleDriveSubtitlesStatus(c echo.Context) error {
	path := c.QueryParam("path")
	fileID, fileName, ok := validDrivePathParam(path)
	if !ok {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid gdrive path is required"))
	}
	resp := driveSubtitlesStatusResponse{DriveSubtitleStatus: h.App.MediastreamRepository.DriveSubtitleStatus(path)}
	if resp.State == mediastream.DriveSubtitlesDone {
		ext := strings.ToLower(filepath.Ext(fileName))
		if ext == "" {
			ext = ".mkv"
		}
		// ffprobe sobre Drive está cacheado desde que se abrió el episodio.
		if mi, err := h.App.MediastreamRepository.GetMediaInfoContext(c.Request().Context(), h.driveInternalURL(fileID, ext)); err == nil {
			resp.Fonts = mi.Fonts
		}
	}
	return h.RespondWithData(c, resp)
}

// HandleDriveSubtitlesExtract lanza en segundo plano la extracción de los subtítulos
// y fuentes embebidos de un archivo de Drive (lee el archivo completo una vez).
//
//	@summary starts extracting the embedded subtitles of a Google Drive file.
//	@route /api/v1/drive/subtitles/extract [POST]
func (h *Handler) HandleDriveSubtitlesExtract(c echo.Context) error {
	var b driveSubtitlesBody
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	fileID, fileName, ok := validDrivePathParam(b.Path)
	if !ok {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid gdrive path is required"))
	}
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("google drive integration is not active"))
	}

	repo := h.App.MediastreamRepository
	if st := repo.DriveSubtitleStatus(b.Path); st.State == mediastream.DriveSubtitlesDone ||
		st.State == mediastream.DriveSubtitlesQueued || st.State == mediastream.DriveSubtitlesRunning {
		return h.RespondWithData(c, st)
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".mkv"
	}
	inputURL := h.driveInternalURL(fileID, ext)
	mi, err := repo.GetMediaInfoContext(c.Request().Context(), inputURL)
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusBadGateway, errors.New("could not read the drive file tracks"))
	}
	if len(extractableSubtitles(mi.Subtitles)) == 0 && len(mi.Fonts) == 0 {
		return h.RespondWithData(c, mediastream.DriveSubtitleStatus{State: mediastream.DriveSubtitlesNone})
	}

	st, err := repo.StartDriveSubtitleExtraction(b.Path, inputURL, mi, h.driveFileSize(c, fileID, b.Path))
	if errors.Is(err, mediastream.ErrDriveSubtitlesTooLarge) {
		return h.RespondWithCodeError(c, http.StatusRequestEntityTooLarge, err)
	}
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, st)
}

// HandleDriveSubtitlesCancel corta una extracción en curso.
//
//	@summary cancels a running Google Drive subtitle extraction.
//	@route /api/v1/drive/subtitles/cancel [POST]
func (h *Handler) HandleDriveSubtitlesCancel(c echo.Context) error {
	var b driveSubtitlesBody
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if _, _, ok := validDrivePathParam(b.Path); !ok {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid gdrive path is required"))
	}
	h.App.MediastreamRepository.CancelDriveSubtitleExtraction(b.Path)
	return h.RespondWithData(c, true)
}

// driveFileSize devuelve el tamaño del archivo de Drive (0 si no se pudo saber): del
// índice local o, si no está, de la API de Drive.
func (h *Handler) driveFileSize(c echo.Context, fileID, drivePath string) int64 {
	return h.driveFileSizeCtx(c.Request().Context(), fileID, drivePath)
}

func (h *Handler) driveFileSizeCtx(ctx context.Context, fileID, drivePath string) int64 {
	var dbFile models.LocalFile
	if err := h.App.Database.Gorm().Select("file_size").Where("path = ?", drivePath).First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
		return dbFile.FileSize
	}
	client, err := h.App.DriveService.GetClient()
	if err != nil {
		return 0
	}
	if f, err := client.GetFile(ctx, fileID); err == nil && f != nil {
		return f.Size
	}
	return 0
}

// driveSubtitleSource abre, para el repositorio, la lectura por rangos de un archivo de
// Drive. Pasa por la misma caché de bloques que la reproducción (/drive/play): lo que
// se bajó para reproducir no se vuelve a pedir, y lo que lee esto lo aprovecha el video.
func (h *Handler) driveSubtitleSource(ctx context.Context, drivePath string) (mkvsubs.Source, error) {
	fileID, _, ok := validDrivePathParam(drivePath)
	if !ok {
		return nil, errors.New("invalid gdrive path")
	}
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return nil, errors.New("google drive integration is not active")
	}
	var fetch drive.RangeFetcher = func(ctx context.Context, rh string) (*http.Response, error) {
		return h.App.DriveService.StreamMedia(ctx, fileID, rh)
	}
	if cache := h.driveBlockCache(); cache != nil {
		h.validateDriveCache(cache, fileID)
		fetch = cache.Fetcher(fileID, fetch)
	}
	if size := h.driveFileSizeCtx(ctx, fileID, drivePath); size > 0 {
		return drive.NewRangeSource(fetch, size), nil
	}
	return drive.ProbeRangeSource(ctx, fetch)
}

type driveSubtitlesWindowBody struct {
	Path string `json:"path"` // gdrive://<fileId>/<ruta>
	// Position: segundo del video en que está el reproductor.
	Position float64 `json:"position"`
	// Full pide leer todo el archivo (no solo la franja), p. ej. para tener todo en disco.
	Full bool `json:"full"`
}

// HandleDriveSubtitlesWindow le dice al servidor en qué segundo está el reproductor para
// que tenga leídos los subtítulos embebidos de esa franja, y devuelve el estado. Lo llama
// el reproductor cada pocos segundos mientras hay pistas progresivas.
//
//	@summary reads the embedded subtitles of a Google Drive file around a playback position.
//	@route /api/v1/drive/subtitles/window [POST]
func (h *Handler) HandleDriveSubtitlesWindow(c echo.Context) error {
	var b driveSubtitlesWindowBody
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if _, _, ok := validDrivePathParam(b.Path); !ok {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid gdrive path is required"))
	}
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("google drive integration is not active"))
	}
	st, err := h.App.MediastreamRepository.DriveSubtitleWindow(c.Request().Context(), b.Path, b.Position, b.Full)
	if errors.Is(err, mediastream.ErrDriveWindowUnavailable) {
		return h.RespondWithCodeError(c, http.StatusNotImplemented, err)
	}
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusBadGateway, err)
	}
	return h.RespondWithData(c, st)
}
