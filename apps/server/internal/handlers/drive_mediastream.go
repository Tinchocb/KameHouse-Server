package handlers

import (
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
// y fuentes embebidos, que en Drive no se extraen (requeriría bajar el archivo entero).
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

	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".mkv"
	}
	publicURL := drivePlayPath + "?fileId=" + url.QueryEscape(fileID)
	internalURL := h.driveInternalURL(fileID, ext)
	repo := h.App.MediastreamRepository

	if streamType == mediastream.StreamTypeTranscode || streamType == mediastream.StreamTypeOptimized {
		mc, err := repo.RequestTranscodeStream(internalURL, clientID, force, caps)
		if err != nil {
			return h.RespondWithError(c, err)
		}
		out := publicDriveContainer(mc, drivePath, publicURL)
		h.signStreamURL(out)
		return h.RespondWithData(c, out)
	}

	var dbFile models.LocalFile
	var techInfo *dto.FileTechnicalInfo
	dbFound := h.App.Database.Gorm().Where("path = ?", drivePath).First(&dbFile).Error == nil
	if dbFound && len(dbFile.TechnicalInfo) > 0 {
		_ = json.Unmarshal(dbFile.TechnicalInfo, &techInfo)
	}

	mediaInfo, err := repo.GetMediaInfo(internalURL)
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

	mc := &mediastream.MediaContainer{
		Filepath:   drivePath,
		Hash:       util.CreateMD5(drivePath),
		StreamType: mediastream.StreamTypeDirect,
		StreamURL:  publicURL,
		MediaInfo:  mediaInfo,
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
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
