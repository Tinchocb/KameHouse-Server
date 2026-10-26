package handlers

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"

	"github.com/labstack/echo/v4"
)

// Las fuentes de Google Drive se leen con ffprobe/ffmpeg a través del propio
// servidor (loopback → /api/v1/drive/play, que hace de proxy con Range hacia
// Google). Ese pedido interno no tiene sesión: se autentica con un token aleatorio
// que vive solo en memoria, vale únicamente para /drive/play y solo desde loopback.
const drivePlayPath = "/api/v1/drive/play"

var (
	driveInternalTokenOnce sync.Once
	driveInternalTokenVal  string
	driveLoopbackOnce      sync.Once
)

func driveInternalToken() string {
	driveInternalTokenOnce.Do(func() {
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			// Sin entropía no hay token: el acceso interno queda deshabilitado.
			return
		}
		driveInternalTokenVal = hex.EncodeToString(b)
	})
	return driveInternalTokenVal
}

// isDriveInternalRequest valida el token interno de un pedido a /drive/play.
func isDriveInternalRequest(c echo.Context) bool {
	if c.Request().URL.Path != drivePlayPath || !isLoopbackRequest(c) {
		return false
	}
	got := c.QueryParam("internal")
	want := driveInternalToken()
	return got != "" && want != "" && subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

// driveLoopbackBase devuelve scheme://host:port para llegar al propio servidor.
func (h *Handler) driveLoopbackBase() string {
	cfg := h.App.Config
	scheme := "http"
	if cfg.Server.TLS.Enabled {
		scheme = "https"
	}
	host := cfg.Server.Host
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		host = "127.0.0.1"
	}
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}
	return fmt.Sprintf("%s://%s:%d", scheme, host, cfg.Server.Port)
}

// configureDriveLoopbackClient hace que el lector de Cues (cassette) confíe en el
// certificado autofirmado del servidor cuando TLS está activo, en vez de
// desactivar la verificación.
func (h *Handler) configureDriveLoopbackClient() {
	driveLoopbackOnce.Do(func() {
		cfg := h.App.Config
		if !cfg.Server.TLS.Enabled || cfg.Server.TLS.CertPath == "" {
			return
		}
		pem, err := os.ReadFile(cfg.Server.TLS.CertPath)
		if err != nil {
			h.App.Logger.Warn().Err(err).Msg("drive: no se pudo leer el certificado TLS para el loopback")
			return
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			h.App.Logger.Warn().Msg("drive: certificado TLS inválido para el loopback")
			return
		}
		cassette.SetLoopbackHTTPClient(&http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12},
			},
		})
	})
}

// driveInternalURL arma la URL de loopback con la que ffprobe/ffmpeg leen el
// archivo de Drive. `ext` le dice al pipeline qué contenedor es (la ruta no la tiene).
func (h *Handler) driveInternalURL(fileID, ext string) string {
	h.configureDriveLoopbackClient()
	q := url.Values{}
	q.Set("fileId", fileID)
	q.Set("ext", ext)
	q.Set("internal", driveInternalToken())
	return h.driveLoopbackBase() + drivePlayPath + "?" + q.Encode()
}

// driveInputURL devuelve lo que ffmpeg/ffprobe abren para una ruta de la biblioteca: las
// gdrive:// pasan por el endpoint interno de loopback; cualquier otra ruta sigue igual.
func (h *Handler) driveInputURL(path string) string {
	if !strings.HasPrefix(path, "gdrive://") {
		return path
	}
	fileID, fileName := parseDrivePath(path)
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".mkv"
	}
	return h.driveInternalURL(fileID, ext)
}

// driveAuthExpiredMsg (424, no 401: el 401 hace que la UI redirija a Ajustes) lo reconoce la interfaz (player-orchestrator) para ofrecer reconectar Drive.
const driveAuthExpiredMsg = "google drive authorization expired"

// Sin cuenta conectada no hay token que venza, así que driveAuthExpiredMsg no aplica.
const driveNotConnectedMsg = "Google Drive no está conectado. Conéctalo en Ajustes → Biblioteca → Google Drive."

// parseDrivePath separa "gdrive://<fileId>/<ruta relativa>" en id y nombre.
func parseDrivePath(p string) (fileID, fileName string) {
	clean := strings.TrimPrefix(p, "gdrive://")
	parts := strings.Split(clean, "/")
	fileName = "stream.mkv"
	if len(parts) > 0 {
		fileID = parts[0]
	}
	if len(parts) > 1 && parts[len(parts)-1] != "" {
		fileName = parts[len(parts)-1]
	}
	return fileID, fileName
}

// publicDriveContainer adapta un container construido sobre la URL interna para
// devolverlo al cliente: no expone la URL con el token interno y quita subtítulos
// y fuentes embebidos, que en Drive solo se exponen una vez extraídos
// (addDriveEmbeddedSubtitles): extraerlos requiere bajar el archivo entero.
func publicDriveContainer(mc *mediastream.MediaContainer, drivePath, publicURL string) *mediastream.MediaContainer {
	out := *mc
	out.Filepath = drivePath
	if out.StreamType == mediastream.StreamTypeDirect {
		out.StreamURL = publicURL
	}
	if mc.MediaInfo != nil {
		mi := *mc.MediaInfo
		mi.Path = drivePath
		mi.Subtitles = nil
		mi.Fonts = nil
		out.MediaInfo = &mi
	}
	return &out
}

// requestDriveMediaContainer resuelve la reproducción de un archivo de Google Drive.
//   - Direct: el navegador lee /drive/play; ffprobe (vía loopback, cacheado) aporta
//     las pistas de audio y capítulos reales para el menú del reproductor.
//   - Transcode: el transcoder usa la URL de loopback como entrada, lo que permite
//     cambiar de pista de audio (el navegador no puede hacerlo en un MKV directo).
func (h *Handler) requestDriveMediaContainer(c echo.Context, drivePath string, streamType mediastream.StreamType, clientID string, force bool, caps *mediastream.ClientCapabilities) error {
	fileID, fileName := parseDrivePath(drivePath)
	if fileID == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid gdrive path"))
	}

	// Sin cuenta conectada (o sin carpeta): ni el token existe, así que AuthExpired no lo
	// ve y la reproducción moría en ffprobe con "exit status 1" sin ninguna pista.
	if h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return h.RespondWithCodeError(c, http.StatusFailedDependency, errors.New(driveNotConnectedMsg))
	}

	// Token vencido o revocado: sin esto el direct play falla en el <video> y el
	// fallback a HLS muere con "ffprobe exit status 1", que oculta la causa real.
	// Con tope: si Google no responde, la comprobación no debe colgar la reproducción
	// (un timeout no cuenta como "vencido": se sigue y falla más abajo con su causa real).
	if h.App.DriveService != nil {
		authCtx, cancelAuth := context.WithTimeout(c.Request().Context(), 5*time.Second)
		expired := h.App.DriveService.AuthExpired(authCtx)
		cancelAuth()
		if expired {
			return h.RespondWithCodeError(c, http.StatusFailedDependency, errors.New(driveAuthExpiredMsg))
		}
	}

	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".mkv"
	}
	publicURL := drivePlayPath + "?fileId=" + url.QueryEscape(fileID)
	internalURL := h.driveInternalURL(fileID, ext)
	repo := h.App.MediastreamRepository

	// Solo original: un pedido de transcode u optimized (fallback, cambio de pista) se sirve directo.
	if (streamType == mediastream.StreamTypeTranscode || streamType == mediastream.StreamTypeOptimized) && repo.DirectPlayOnly() {
		streamType = mediastream.StreamTypeDirect
	}

	if streamType == mediastream.StreamTypeTranscode || streamType == mediastream.StreamTypeOptimized {
		return h.respondDriveTranscode(c, drivePath, publicURL, internalURL, fileID, fileName, clientID, force, caps)
	}

	var dbFile models.LocalFile
	var techInfo *dto.FileTechnicalInfo
	dbFound := false
	if h.App != nil && h.App.Database != nil {
		dbFound = h.App.Database.Gorm().WithContext(c.Request().Context()).
			Select("id, technical_info").
			Where("path = ?", drivePath).
			First(&dbFile).Error == nil
	}
	if dbFound && len(dbFile.TechnicalInfo) > 0 {
		_ = json.Unmarshal(dbFile.TechnicalInfo, &techInfo)
	}

	mediaInfo, err := repo.GetMediaInfoContext(c.Request().Context(), internalURL)
	if err != nil {
		// Sin ffprobe la reproducción directa sigue funcionando, solo sin pistas.
		h.App.Logger.Warn().Err(err).Str("fileId", fileID).Msg("drive: no se pudo leer la media info, se reproduce sin pistas")
		mediaInfo = &videofile.MediaInfo{Extension: strings.TrimPrefix(ext, ".")}
		if techInfo != nil && techInfo.VideoStream != nil {
			mediaInfo.Video = &videofile.Video{
				Width:  uint32(techInfo.VideoStream.Width),
				Height: uint32(techInfo.VideoStream.Height),
				Codec:  techInfo.VideoStream.Codec,
			}
		}
	} else if dbFound && (techInfo == nil || len(techInfo.AudioStreams) == 0) && len(mediaInfo.Audios) > 0 {
		h.persistDriveAudioStreams(dbFile.ID, techInfo, mediaInfo.Audios)
	}

	// Igual que en las rutas locales: directo solo si este cliente decodifica el archivo; si no, transcode.
	// Antes Drive servia siempre directo, sin mirar codecs ni capacidades (audio AC-3 mudo, mkv no soportado).
	if repo.ResolveClientStreamType(mediastream.StreamTypeDirect, mediaInfo, caps) == mediastream.StreamTypeTranscode {
		return h.respondDriveTranscode(c, drivePath, publicURL, internalURL, fileID, fileName, clientID, force, caps)
	}

	mc := &mediastream.MediaContainer{
		Filepath:   drivePath,
		Hash:       util.CreateMD5(drivePath),
		StreamType: mediastream.StreamTypeDirect,
		StreamURL:  publicURL,
		MediaInfo:  mediaInfo,
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(c.Request().Context(), out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
	return h.RespondWithData(c, out)
}

// respondDriveTranscode sirve un archivo de Drive en transcode (HLS). Los errores tipados del
// transcoder salen con su codigo HTTP: 409 si la transcodificacion esta desactivada, 503 si no arranca.
func (h *Handler) respondDriveTranscode(c echo.Context, drivePath, publicURL, internalURL, fileID, fileName, clientID string, force bool, caps *mediastream.ClientCapabilities) error {
	mc, err := h.App.MediastreamRepository.RequestTranscodeStream(internalURL, clientID, force, caps)
	if err != nil {
		if errors.Is(err, mediastream.ErrTranscodeDisabled) || errors.Is(err, mediastream.ErrDirectOnly) {
			return h.RespondWithCodeError(c, http.StatusConflict, err)
		}
		return h.RespondWithError(c, err)
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(c.Request().Context(), out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
	return h.RespondWithData(c, out)
}

// persistDriveAudioStreams guarda en el local_file las pistas de audio detectadas,
// para que el resto de la app (idiomas disponibles, selector de origen) las conozca
// sin volver a sondear Drive.
func (h *Handler) persistDriveAudioStreams(localFileID uint, techInfo *dto.FileTechnicalInfo, audios []videofile.Audio) {
	if techInfo == nil {
		techInfo = &dto.FileTechnicalInfo{}
	}
	streams := make([]*dto.AudioStreamInfo, 0, len(audios))
	for _, a := range audios {
		s := &dto.AudioStreamInfo{Codec: a.Codec}
		if a.Language != nil {
			s.Language = *a.Language
		}
		if a.Title != nil {
			s.Title = *a.Title
		}
		streams = append(streams, s)
	}
	techInfo.AudioStreams = streams
	raw, err := json.Marshal(techInfo)
	if err != nil {
		return
	}
	if err := h.App.Database.Gorm().Model(&models.LocalFile{}).
		Where("id = ?", localFileID).
		Update("technical_info", raw).Error; err != nil {
		h.App.Logger.Warn().Err(err).Uint("localFileId", localFileID).Msg("drive: no se pudieron guardar las pistas de audio")
	}
}
