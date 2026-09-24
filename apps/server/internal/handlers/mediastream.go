package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util"
	"kamehouse/internal/util/ffmpegutil"
	"kamehouse/internal/util/result"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	skipTimesCache    = result.NewBoundedCache[int, []models.EpisodeSkipTime](1000)
	skipTimesCacheTTL = 5 * time.Minute
)



var (
	jikanHTTPClient = &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10,
			MaxIdleConnsPerHost: 2,
			IdleConnTimeout:     30 * time.Second,
		},
	}
	jikanSingleFlight singleflight.Group
)



// HandleGetMediastreamSettings returns the mediastream settings.
//
//	@summary get mediastream settings.
//	@desc This returns the mediastream settings.
//	@returns models.MediastreamSettings
//	@route /api/v1/mediastream/settings [GET]
func (h *Handler) HandleGetMediastreamSettings(c echo.Context) error {
	mediastreamSettings, found := h.App.Database.GetMediastreamSettings()
	if !found {
		// Create default settings if none exist
		defaultSettings := &models.MediastreamSettings{
			BaseModel: models.BaseModel{
				ID: 1,
			},
			TranscodeEnabled: false,
			TranscodeHwAccel: "auto",
			TranscodePreset:  "fast",
			TranscodeThreads: 0,
			DirectPlayOnly:   false,
			FfmpegPath:       "",
			FfprobePath:      "",
		}
		saved, err := h.App.Database.UpsertMediastreamSettings(defaultSettings)
		if err != nil {
			return h.RespondWithError(c, err)
		}
		return h.RespondWithData(c, saved)
	}

	return h.RespondWithData(c, mediastreamSettings)
}

// HandleSaveMediastreamSettings saves the mediastream settings.
//
//	@summary save mediastream settings.
//	@desc This saves the mediastream settings.
//	@returns models.MediastreamSettings
//	@route /api/v1/mediastream/settings [PATCH]
func (h *Handler) HandleSaveMediastreamSettings(c echo.Context) error {
	type body struct {
		Settings models.MediastreamSettings `json:"settings"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	settings, err := h.App.Database.UpsertMediastreamSettings(&b.Settings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.InitOrRefreshMediastreamSettings()

	return h.RespondWithData(c, settings)
}

// HandleRequestMediastreamMediaContainer requests a media stream container.
//
//	@summary request media stream.
//	@desc This requests a media stream and returns the media container to start the playback.
//	@returns mediastream.MediaContainer
//	@route /api/v1/mediastream/request [POST]
func (h *Handler) HandleRequestMediastreamMediaContainer(c echo.Context) error {

	type body struct {
		Path             string                 `json:"path"`             // The path of the file.
		StreamType       mediastream.StreamType `json:"streamType"`       // The type of stream to request.
		AudioStreamIndex int                    `json:"audioStreamIndex"` // The audio stream index to use. (unused)
		ClientID         string                 `json:"clientID"`         // The session id
		Force            bool                   `json:"force"`            // Force transcoder init even if TranscodeEnabled=false (explicit user action, e.g. switching audio track during direct play).
		// Codecs the client can decode natively (probed via canPlayType/MediaSource).
		// Omitted/null falls back to static Chromium-based assumptions.
		ClientCapabilities *mediastream.ClientCapabilities `json:"clientCapabilities"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.Path == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("path parameter is required"))
	}
	if strings.HasPrefix(b.Path, "http://") || strings.HasPrefix(b.Path, "https://") {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("remote URLs are not allowed for local playback"))
	}

	if strings.HasPrefix(b.Path, "gdrive://") {
		clean := strings.TrimPrefix(b.Path, "gdrive://")
		parts := strings.Split(clean, "/")
		fileID := ""
		fileName := "stream.mkv"
		if len(parts) > 0 {
			fileID = parts[0]
		}
		if len(parts) > 1 {
			fileName = parts[len(parts)-1]
		}
		if fileID == "" {
			return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid gdrive path"))
		}

		var dbFile models.LocalFile
		var techInfo *dto.FileTechnicalInfo
		if err := h.App.Database.Gorm().Where("path = ?", b.Path).First(&dbFile).Error; err == nil {
			if len(dbFile.TechnicalInfo) > 0 {
				_ = json.Unmarshal(dbFile.TechnicalInfo, &techInfo)
			}
		}

		streamURL := fmt.Sprintf("/api/v1/drive/play?fileId=%s", fileID)
		ext := filepath.Ext(fileName)
		if ext == "" {
			ext = ".mkv"
		}

		mediaInfo := &videofile.MediaInfo{
			Path:      b.Path,
			Extension: strings.TrimPrefix(ext, "."),
		}
		if techInfo != nil && techInfo.VideoStream != nil {
			mediaInfo.Video = &videofile.Video{
				Width:  uint32(techInfo.VideoStream.Width),
				Height: uint32(techInfo.VideoStream.Height),
				Codec:  techInfo.VideoStream.Codec,
			}
		}

		mediaContainer := &mediastream.MediaContainer{
			Filepath:   b.Path,
			Hash:       util.CreateMD5(b.Path),
			StreamType: mediastream.StreamTypeDirect,
			StreamURL:  streamURL,
			MediaInfo:  mediaInfo,
		}

		h.signStreamURL(mediaContainer)
		return h.RespondWithData(c, mediaContainer)
	}

	if _, err := os.Stat(b.Path); os.IsNotExist(err) {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("media file not found"))
	}

	// Prevent path traversal: ensure the file is within configured library directories
	// Deny-by-default: si no hay librerías o falla la DB, denegar (antes fail-open).
	libPaths, libErr := h.App.Database.GetAllLibraryPathsFromSettings()
	if libErr != nil || len(libPaths) == 0 {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("library not available"))
	}
	allowed := false
	for _, lp := range libPaths {
		if util.IsFileUnderDir(lp, b.Path) {
			allowed = true
			break
		}
	}
	if !allowed {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access denied: file is not within configured library folders"))
	}

	var mediaContainer *mediastream.MediaContainer
	var err error

	switch b.StreamType {
	case mediastream.StreamTypeDirect:
		mediaContainer, err = h.App.MediastreamRepository.RequestDirectPlay(b.Path, b.ClientID, b.ClientCapabilities)
	case mediastream.StreamTypeTranscode:
		mediaContainer, err = h.App.MediastreamRepository.RequestTranscodeStream(b.Path, b.ClientID, b.Force, b.ClientCapabilities)
	case mediastream.StreamTypeOptimized:
		mediaContainer, err = h.App.MediastreamRepository.RequestOptimizedStream(b.Path, b.ClientID)
	default:
		err = fmt.Errorf("stream type %s not implemented", b.StreamType)
	}
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.signStreamURL(mediaContainer)
	return h.RespondWithData(c, mediaContainer)
}

func (h *Handler) signStreamURL(mediaContainer *mediastream.MediaContainer) {
	if mediaContainer != nil && h.App.Config != nil && h.App.Config.Server.Password != "" {
		// Generate short-lived token (5 minutes) for HLS/DirectPlay to avoid long-lived tokens in URLs/logs
		hmacAuth := h.App.GetServerPasswordHMACAuth()
		// Temporarily reduce TTL for token (5 minutes)
		originalTTL := hmacAuth.TTL()
		hmacAuth.SetTTL(5 * time.Minute)
		if token, tokenErr := hmacAuth.GenerateToken("*"); tokenErr == nil {
			sep := "?"
			if strings.Contains(mediaContainer.StreamURL, "?") {
				sep = "&"
			}
			mediaContainer.StreamURL += sep + "token=" + token
		}
		hmacAuth.SetTTL(originalTTL)
	}
}

// HandlePreloadMediastreamMediaContainer preloads a media stream for playback.
//
//	@summary preloads media stream for playback.
//	@desc This preloads a media stream by extracting the media information and attachments.
//	@returns bool
//	@route /api/v1/mediastream/preload [POST]
func (h *Handler) HandlePreloadMediastreamMediaContainer(c echo.Context) error {

	type body struct {
		Path               string                 `json:"path"`               // The path of the file.
		StreamType         mediastream.StreamType `json:"streamType"`         // The type of stream to request.
		AudioStreamIndex   int                    `json:"audioStreamIndex"`   // The audio stream index to use.
		PreferredAudioLang string                 `json:"preferredAudioLang"` // The preferred audio language.
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.Path == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("path parameter is required"))
	}
	if strings.HasPrefix(b.Path, "http://") || strings.HasPrefix(b.Path, "https://") {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("remote URLs are not allowed for local playback"))
	}
	if strings.HasPrefix(b.Path, "gdrive://") {
		return h.RespondWithData(c, true)
	}
	if _, err := os.Stat(b.Path); os.IsNotExist(err) {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("media file not found"))
	}

	// Prevent path traversal: ensure the file is within configured library directories
	libPaths, libErr := h.App.Database.GetAllLibraryPathsFromSettings()
	if libErr != nil || len(libPaths) == 0 {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("library not available"))
	}
	allowed := false
	for _, lp := range libPaths {
		if util.IsFileUnderDir(lp, b.Path) {
			allowed = true
			break
		}
	}
	if !allowed {
		return h.RespondWithCodeError(c, http.StatusForbidden, errors.New("access denied: file is not within configured library folders"))
	}


	var err error

	switch b.StreamType {
	case mediastream.StreamTypeTranscode:
		err = h.App.MediastreamRepository.RequestPreloadTranscodeStream(b.Path, b.PreferredAudioLang)
	case mediastream.StreamTypeDirect:
		err = h.App.MediastreamRepository.RequestPreloadDirectPlay(b.Path)
	case mediastream.StreamTypeOptimized:
		err = h.App.MediastreamRepository.RequestPreloadOptimizedStream(b.Path)
	default:
		err = fmt.Errorf("stream type %s not implemented", b.StreamType)
	}
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

func (h *Handler) HandleMediastreamGetSubtitles(c echo.Context) error {
	c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Response().Header().Set("Pragma", "no-cache")
	c.Response().Header().Set("Expires", "0")
	return h.App.MediastreamRepository.ServeEchoExtractedSubtitles(c)
}

func (h *Handler) HandleMediastreamGetPGSEvents(c echo.Context) error {
	c.Response().Header().Set("Cache-Control", "public, max-age=86400")
	return h.App.MediastreamRepository.ServeEchoParsedPGS(c)
}

func (h *Handler) HandleMediastreamGetAttachments(c echo.Context) error {
	// tell the client not to cache the response
	c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Response().Header().Set("Pragma", "no-cache")
	c.Response().Header().Set("Expires", "0")
	return h.App.MediastreamRepository.ServeEchoExtractedAttachments(c)
}

// getClientID resolves the client ID from query param, header, or context cookie.
func (h *Handler) getClientID(c echo.Context) string {
	client := c.QueryParam("clientID")
	if client != "" {
		return client
	}
	client = c.QueryParam("clientId")
	if client != "" {
		return client
	}
	if val := c.Get("KameHouse-Client-Id"); val != nil {
		if id, ok := val.(string); ok && id != "" {
			return id
		}
	}
	return "1"
}

//
// Direct
//

func (h *Handler) HandleMediastreamDirectPlay(c echo.Context) error {
	client := h.getClientID(c)
	return h.App.MediastreamRepository.ServeEchoDirectPlay(c, client)
}

//
// Transcode
//

func (h *Handler) HandleMediastreamTranscode(c echo.Context) error {
	client := h.getClientID(c)
	return h.App.MediastreamRepository.ServeEchoTranscodeStream(c, client)
}

// HandleMediastreamShutdownTranscodeStream shuts down the transcode stream.
//
//	@summary shuts down the transcode stream.
//	@desc This requests the transcoder to shut down. It should be called when unmounting the player (playback is no longer needed).
//	@desc This will also send an events.MediastreamShutdownStream event.
//	@desc It will not return any error and is safe to call multiple times.
//	@returns bool
//	@route /api/v1/mediastream/shutdown-transcode [POST]
func (h *Handler) HandleMediastreamShutdownTranscodeStream(c echo.Context) error {
	client := h.getClientID(c)
	h.App.MediastreamRepository.ShutdownTranscodeStream(client)
	return h.RespondWithData(c, true)
}

//
// Serve file
//

func (h *Handler) HandleMediastreamServeOptimizedStatic(c echo.Context) error {
	client := h.getClientID(c)
	return h.App.MediastreamRepository.ServeEchoOptimizedStream(c, client)
}

func (h *Handler) HandleMediastreamFile(c echo.Context) error {
	client := h.getClientID(c)
	fp := c.QueryParam("path")
	libraryPaths := h.App.Settings.GetLibrary().GetAllPaths()
	return h.App.MediastreamRepository.ServeEchoFile(c, fp, client, libraryPaths)
}

// HandleGetEpisodeSkipTimes returns the custom/saved skip times for a given episode.
//
//	@summary get episode skip times.
//	@desc This gets the saved skip times (OP/ED) for a specific episode of a series.
//	@returns models.EpisodeSkipTime
//	@route /api/v1/mediastream/skip-times [GET]
func (h *Handler) HandleGetEpisodeSkipTimes(c echo.Context) error {
	mediaIdStr := c.QueryParam("mediaId")
	malIdStr := c.QueryParam("malId")
	episodeNumStr := c.QueryParam("episodeNumber")

	var mediaId, malId, episodeNum int
	if mediaIdStr != "" {
		if v, err := strconv.Atoi(mediaIdStr); err == nil && v > 0 {
			mediaId = v
		}
	}
	if malIdStr != "" {
		if v, err := strconv.Atoi(malIdStr); err == nil && v > 0 {
			malId = v
		}
	}
	if episodeNumStr != "" {
		if v, err := strconv.Atoi(episodeNumStr); err == nil && v > 0 {
			episodeNum = v
		}
	}

	// Resolve mediaId if malId is provided instead
	if mediaId == 0 && malId > 0 {
		var lm models.LibraryMedia
		if err := h.App.Database.Gorm().Where("myanimelist_id = ?", malId).First(&lm).Error; err == nil {
			mediaId = int(lm.ID)
		}
	}

	if mediaId <= 0 || episodeNum <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid mediaId/malId or episodeNumber"))
	}

	siblings := h.getOrLoadSkipTimes(mediaId)

	skipTime, found := findSkipTimeForEpisode(siblings, episodeNum)
	if found {
		return h.RespondWithData(c, skipTime)
	}

	// Trigger oportunista: si no hay marcas para este episodio, lanzamos
	// un scan de detección en segundo plano (una sola vez por serie por run
	// del servidor). El request actual sigue respondiendo con la heurística
	// fill-forward de abajo; cuando el scan termina emite invalidate-queries
	// y el cliente refetchea.
	//
	// Gates (en orden, para no "gastar" el intento único si decidimos no
	// escanear): (1) el detector existe, (2) el setting está habilitado,
	// (3) no hay ya un scan en curso, (4) no hay un transcode activo — el
	// fingerprinting compite por CPU/IO con el transcode en tiempo real, así
	// que si el usuario está transcodeando, diferimos (se reintenta en el
	// próximo episodio sin marcas). Solo entonces marcamos attempted.
	if d := h.App.SkipDetector; d != nil && h.autoDetectSkipTimesEnabled() && !d.IsScanning(mediaId) && !h.transcodeActive() && d.MarkAttemptedOnce(mediaId) {
		go func(id int) {
			defer func() {
				if r := recover(); r != nil {
					h.App.Logger.Error().Interface("panic", r).Int("mediaId", id).Msg("mediastream: panic in opportunistic skip-time scan")
				}
			}()
			ctx, cancel := context.WithTimeout(h.App.ShutdownCtx(), 30*time.Minute)
			defer cancel()
			if err := d.ScanSeries(ctx, id); err != nil {
				h.App.Logger.Debug().Err(err).Int("mediaId", id).Msg("mediastream: scan oportunista de skip times falló")
				d.ResetAttempted(id)
			}
		}(mediaId)
	}

	// Phase 5: Fill-forward heuristic (look back up to 3 episodes)
	heuristic := fillForwardHeuristic(siblings, episodeNum)
	if heuristic != nil {
		return h.RespondWithData(c, heuristic)
	}

	return h.RespondWithData(c, nil)
}

func (h *Handler) getOrLoadSkipTimes(mediaId int) []models.EpisodeSkipTime {
	if cached, ok := skipTimesCache.Get(mediaId); ok {
		return cached
	}

	var siblings []models.EpisodeSkipTime
	if err := h.App.Database.Gorm().Where("media_id = ?", mediaId).Find(&siblings).Error; err != nil {
		return nil
	}

	skipTimesCache.SetT(mediaId, siblings, skipTimesCacheTTL)
	return siblings
}

func findSkipTimeForEpisode(siblings []models.EpisodeSkipTime, episodeNum int) (*models.EpisodeSkipTime, bool) {
	for i := range siblings {
		if siblings[i].EpisodeNumber == episodeNum {
			return &siblings[i], true
		}
	}
	return nil, false
}

func fillForwardHeuristic(siblings []models.EpisodeSkipTime, episodeNum int) *models.EpisodeSkipTime {
	if len(siblings) < 2 {
		return nil
	}

	var matchedOp *models.EpisodeSkipTime
	var matchedEd *models.EpisodeSkipTime

	for offset := 1; offset <= 3; offset++ {
		targetEp := episodeNum - offset
		if targetEp <= 0 {
			continue
		}

		for i := range siblings {
			if siblings[i].EpisodeNumber == targetEp {
				if matchedOp == nil && siblings[i].OpEnd > 0 {
					validCount := 0
					for j := range siblings {
						if siblings[j].OpEnd > 0 && siblings[j].OpStart >= siblings[i].OpStart-2 && siblings[j].OpStart <= siblings[i].OpStart+2 {
							validCount++
						}
					}
					if validCount >= 2 {
						ref := siblings[i]
						matchedOp = &ref
					}
				}

				if matchedEd == nil && siblings[i].EdOffset != 0 {
					validEdCount := 0
					for j := range siblings {
						if siblings[j].EdOffset != 0 && siblings[j].EdOffset >= siblings[i].EdOffset-3 && siblings[j].EdOffset <= siblings[i].EdOffset+3 {
							validEdCount++
						}
					}
					if validEdCount >= 2 {
						ref := siblings[i]
						matchedEd = &ref
					}
				}
			}
		}
		if matchedOp != nil && matchedEd != nil {
			break
		}
	}

	if matchedOp != nil || matchedEd != nil {
		res := &models.EpisodeSkipTime{
			MediaID:       siblings[0].MediaID,
			EpisodeNumber: episodeNum,
			Source:        "heuristic",
		}
		if matchedOp != nil {
			res.OpStart = matchedOp.OpStart
			res.OpEnd = matchedOp.OpEnd
		}
		if matchedEd != nil {
			res.EdOffset = matchedEd.EdOffset
			res.EdEnd = matchedEd.EdEnd
		}
		return res
	}
	return nil
}

func invalidateSkipTimesCache(mediaId int) {
	skipTimesCache.Delete(mediaId)
}

// HandleSaveEpisodeSkipTimes saves the skip times for an episode.
//
//	@summary save episode skip times.
//	@desc This saves custom skip times for an episode. If applyToSeason is true, it propagates it as default offsets for all other episodes of the same series.
//	@route /api/v1/mediastream/skip-times [POST]
func (h *Handler) HandleSaveEpisodeSkipTimes(c echo.Context) error {
	type body struct {
		MediaID       int     `json:"mediaId"`
		MalID         int     `json:"malId"`
		EpisodeNumber int     `json:"episodeNumber"`
		OpStart       float64 `json:"opStart"`
		OpEnd         float64 `json:"opEnd"`
		EdOffset      float64 `json:"edOffset"`
		EdEnd         float64 `json:"edEnd"`
		Source        string  `json:"source"`
		Confidence    float64 `json:"confidence"`
		ApplyToSeason bool    `json:"applyToSeason"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Resolve mediaId if malId is provided instead
	mediaID := b.MediaID
	if mediaID == 0 && b.MalID > 0 {
		var lm models.LibraryMedia
		if err := h.App.Database.Gorm().Where("myanimelist_id = ?", b.MalID).First(&lm).Error; err == nil {
			mediaID = int(lm.ID)
		}
	}

	if mediaID == 0 || b.EpisodeNumber == 0 {
		return h.RespondWithError(c, fmt.Errorf("invalid mediaId/malId or episodeNumber"))
	}

	// D7: Validación de rangos (integridad)
	if b.OpStart < 0 || b.OpEnd < 0 || b.EdOffset < 0 || b.EdEnd < 0 {
		return h.RespondWithCodeError(c, 400, fmt.Errorf("invalid skip times: cannot be negative"))
	}
	if b.OpEnd > 0 && b.OpStart >= b.OpEnd {
		return h.RespondWithCodeError(c, 400, fmt.Errorf("invalid skip times: op start must be before op end"))
	}
	if b.EdEnd > 0 && b.EdOffset >= b.EdEnd {
		return h.RespondWithCodeError(c, 400, fmt.Errorf("invalid skip times: ed start must be before ed end"))
	}
	// Tiempos absurdos (> 10 horas)
	if b.OpEnd > 36000 || b.EdEnd > 36000 {
		return h.RespondWithCodeError(c, 400, fmt.Errorf("invalid skip times: unreasonably large"))
	}

	// Save or update the single episode skip times
	skipTime := models.EpisodeSkipTime{
		MediaID:       mediaID,
		EpisodeNumber: b.EpisodeNumber,
		OpStart:       b.OpStart,
		OpEnd:         b.OpEnd,
		EdOffset:      b.EdOffset,
		EdEnd:         b.EdEnd,
		Source:        b.Source,
		Confidence:    b.Confidence,
	}

	err := h.App.Database.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "media_id"}, {Name: "episode_number"}},
		DoUpdates: clause.AssignmentColumns([]string{"op_start", "op_end", "ed_offset", "ed_end", "source", "confidence"}),
	}).Create(&skipTime).Error
	if err != nil {
		return h.RespondWithError(c, err)
	}

	invalidateSkipTimesCache(mediaID)

	// Propagate if requested
	episodesUpdated := 0
	// D4/D7: Solo propagar si la confianza es alta o la fuente es 100% segura.
	// No propagar "heuristic" que ensucia los demás episodios.
	if b.ApplyToSeason && b.Source != "heuristic" && b.Confidence > 0 {
		var episodes []models.LibraryEpisode
		if err := h.App.Database.Gorm().Where("library_media_id = ?", mediaID).Find(&episodes).Error; err == nil {
			var skipTimes []models.EpisodeSkipTime
			for _, ep := range episodes {
				if ep.EpisodeNumber == b.EpisodeNumber {
					continue // skip the current one
				}
				skipTimes = append(skipTimes, models.EpisodeSkipTime{
					MediaID:       mediaID,
					EpisodeNumber: ep.EpisodeNumber,
					OpStart:       b.OpStart,
					OpEnd:         b.OpEnd,
					// D3: No copiar Ed absoluto, su posición real varía según duración.
					EdOffset:   0,
					EdEnd:      0,
					Source:     "propagated",
					Confidence: b.Confidence,
				})
			}
			if len(skipTimes) > 0 {
				if err := h.App.Database.Gorm().Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "media_id"}, {Name: "episode_number"}},
					DoUpdates: clause.AssignmentColumns([]string{"op_start", "op_end", "ed_offset", "ed_end", "source", "confidence"}),
				}).Create(&skipTimes).Error; err != nil {
					h.App.Logger.Error().Err(err).Msg("mediastream: failed to propagate skip times to season")
				} else {
					episodesUpdated = len(skipTimes)
				}
			}
		} else {
			h.App.Logger.Warn().Err(err).Int("mediaID", mediaID).Msg("mediastream: failed to query episodes for season propagation")
		}
	}

	return h.RespondWithData(c, map[string]interface{}{
		"saved":           true,
		"episodesUpdated": episodesUpdated,
		"appliedToSeason": b.ApplyToSeason,
	})
}

// autoDetectSkipTimesEnabled indica si el scan oportunista de skip times está
// habilitado en la configuración de la biblioteca (default true).
func (h *Handler) autoDetectSkipTimesEnabled() bool {
	if h.App.Settings == nil {
		return false
	}
	return h.App.Settings.GetLibrary().AutoDetectSkipTimes
}

// transcodeActive indica si hay una reproducción en curso servida por el
// transcoder (que compite fuerte por CPU/IO). El direct play es barato y no se
// considera. Ante cualquier duda (repo no inicializado) devolvemos false para no
// bloquear la detección.
func (h *Handler) transcodeActive() bool {
	repo := h.App.MediastreamRepository
	if repo == nil || !repo.TranscoderIsInitialized() {
		return false
	}
	return len(repo.ActiveVideoFileHashes()) > 0
}

// HandleScanEpisodeSkipTimes triggers a background scan to detect skip times for a series.
//
//	@summary trigger skip times auto-scan.
//	@desc Starts a background detection job (AnimeThemes → cross-episode fingerprint → ASS subtitles) to find intro/outro boundaries for all episodes of a series.
//	@route /api/v1/mediastream/skip-times/scan [POST]
func (h *Handler) HandleScanEpisodeSkipTimes(c echo.Context) error {
	type body struct {
		MediaID int `json:"mediaId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.MediaID == 0 {
		return h.RespondWithError(c, fmt.Errorf("invalid mediaId"))
	}

	detector := h.App.SkipDetector
	if detector == nil {
		return h.RespondWithError(c, fmt.Errorf("skip detector is not initialized yet"))
	}
	if detector.IsScanning(b.MediaID) {
		return h.RespondWithCodeError(c, 409, fmt.Errorf("a scan is already in progress for this series"))
	}

	// Async para no bloquear el request HTTP: un scan puede tardar minutos.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Int("mediaId", b.MediaID).Msg("mediastream: panic in auto skip-time scan")
			}
		}()
		ctx, cancel := context.WithTimeout(h.App.ShutdownCtx(), 30*time.Minute)
		defer cancel()
		if err := detector.ScanSeries(ctx, b.MediaID); err != nil {
			h.App.Logger.Error().Err(err).Int("mediaId", b.MediaID).Msg("mediastream: auto skip-time scan failed")
		}
	}()

	return h.RespondWithData(c, map[string]any{"ok": true, "message": "Scan started"})
}

// HandleScanAllSkipTimes triggers a library-wide background skip-times scan.
//
//	@summary trigger library-wide skip times scan.
//	@desc Runs the skip-times detection chain (AnimeThemes → cross-episode fingerprint → ASS subtitles) for every series with local files, sequentially, in the background. Progress is emitted via SKIP_SCAN_STATUS events with mediaId -1.
//	@route /api/v1/mediastream/skip-times/scan-all [POST]
func (h *Handler) HandleScanAllSkipTimes(c echo.Context) error {
	detector := h.App.SkipDetector
	if detector == nil {
		return h.RespondWithError(c, fmt.Errorf("skip detector is not initialized yet"))
	}
	if detector.IsLibraryScanning() {
		return h.RespondWithError(c, fmt.Errorf("a library-wide scan is already in progress"))
	}

	// Async y sin timeout global: una biblioteca grande puede tardar horas; cada
	// serie ya tiene su propio timeout dentro de ScanLibrary.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("mediastream: panic in library-wide skip-time scan")
			}
		}()
		if err := detector.ScanLibrary(h.App.ShutdownCtx()); err != nil {
			h.App.Logger.Error().Err(err).Msg("mediastream: library-wide skip-time scan failed")
		}
	}()

	return h.RespondWithData(c, map[string]any{"ok": true, "message": "Library scan started"})
}

// HandleResolveMAL resolves a media's MAL ID dynamically.
//
//	@summary resolve MAL ID.
//	@desc Looks up MAL ID on Jikan.
//	@route /api/v1/mediastream/skip-times/resolve-mal [GET]
func (h *Handler) HandleResolveMAL(c echo.Context) error {
	mediaIdStr := c.QueryParam("mediaId")
	mediaId, err := strconv.Atoi(mediaIdStr)
	if err != nil || mediaId <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive mediaId is required"))
	}

	// mediaId es el id EXTERNO (derivado de TMDB), no la PK de library_media:
	// buscarlo por PK devolvía siempre ErrRecordNotFound y este endpoint
	// respondía malId=nil para TODA la librería, dejando sin MAL id al fallback
	// de AniSkip. Ver db.GetLibraryMediaByExternalMediaID.
	lmPtr, err := db.GetLibraryMediaByExternalMediaID(h.App.Database, mediaId)
	if err != nil {
		// Media que no está en la librería local (p. ej. entrada online pura):
		// es un "sin mapeo" esperable, no un error del servidor.
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return h.RespondWithData(c, map[string]interface{}{"malId": nil})
		}
		return h.RespondWithError(c, err)
	}
	lm := *lmPtr
	// Deterministic TMDB→MAL map for the Dragon Ball franchise.
	// Authoritative and offline (no Jikan dependency): it wins even over a stored
	// myanimelist_id, so a wrong non-zero id (not just 0) is corrected for these 5 series.
	// TMDB IDs match dragonBallArcs in internal/library/anime/intelligence.go.
	var dragonBallMalMap = map[int]int{
		12609:  223,   // Dragon Ball
		12971:  813,   // Dragon Ball Z
		12697:  225,   // Dragon Ball GT
		62715:  30694, // Dragon Ball Super
		236994: 56894, // Dragon Ball Daima
	}
	if malID, ok := dragonBallMalMap[lm.TmdbID]; ok {
		if lm.MyanimelistId != malID {
			db.UpdateLibraryMediaMappings(h.App.Database, lm.ID, lm.AnidbId, malID)
		}
		return h.RespondWithData(c, map[string]interface{}{"malId": malID})
	}

	if lm.MyanimelistId > 0 {
		return h.RespondWithData(c, map[string]interface{}{"malId": lm.MyanimelistId})
	}

	searchTitle := lm.TitleEnglish
	if searchTitle == "" {
		searchTitle = lm.TitleRomaji
	}
	if searchTitle == "" {
		searchTitle = lm.TitleOriginal
	}

	if searchTitle != "" {
		res, sfErr, _ := jikanSingleFlight.Do(searchTitle, func() (interface{}, error) {
			reqUrl := fmt.Sprintf("https://api.jikan.moe/v4/anime?q=%s&limit=1", url.QueryEscape(searchTitle))
			req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodGet, reqUrl, nil)
			if err != nil {
				return 0, err
			}
			resp, err := jikanHTTPClient.Do(req)
			if err != nil {
				return 0, err
			}
			defer resp.Body.Close()
			var jikanResp struct {
				Data []struct {
					MalId int `json:"mal_id"`
				} `json:"data"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&jikanResp); err == nil && len(jikanResp.Data) > 0 {
				return jikanResp.Data[0].MalId, nil
			}
			return 0, errors.New("no mal_id found")
		})

		if sfErr == nil {
			if malId, ok := res.(int); ok && malId > 0 {
				db.UpdateLibraryMediaMappings(h.App.Database, lm.ID, lm.AnidbId, malId)
				return h.RespondWithData(c, map[string]interface{}{"malId": malId})
			}
		}
	}


	return h.RespondWithData(c, map[string]interface{}{"malId": nil})
}

// HandleGetFFmpegStatus returns the current status and resolved paths of FFmpeg and FFprobe.
//
//	@summary get ffmpeg binary status.
//	@desc This returns the status and version of ffmpeg and ffprobe binaries.
//	@returns ffmpegutil.FFmpegStatus
//	@route /api/v1/mediastream/ffmpeg/status [GET]
func (h *Handler) HandleGetFFmpegStatus(c echo.Context) error {
	mSettings, _ := h.App.Database.GetMediastreamSettings()
	var customFfmpeg, customFfprobe string
	if mSettings != nil {
		customFfmpeg = mSettings.FfmpegPath
		customFfprobe = mSettings.FfprobePath
	}

	var status ffmpegutil.FFmpegStatus = h.App.FFmpegManager.GetStatus(customFfmpeg, customFfprobe)
	return h.RespondWithData(c, status)
}

// HandleInstallFFmpeg starts background download and installation of FFmpeg and FFprobe.
//
//	@summary install ffmpeg binaries.
//	@desc Downloads and extracts ffmpeg and ffprobe into cache/bin directory.
//	@route /api/v1/mediastream/ffmpeg/install [POST]
func (h *Handler) HandleInstallFFmpeg(c echo.Context) error {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("mediastream: panic installing FFmpeg binaries")
			}
		}()
		ctx, cancel := context.WithTimeout(h.App.ShutdownCtx(), 15*time.Minute)
		defer cancel()

		err := h.App.FFmpegManager.EnsureBinaries(ctx, func(pct int, msg string) {
			h.App.WSEventManager.SendEvent("ffmpeg-download-progress", map[string]interface{}{
				"progress": pct,
				"status":   msg,
			})
		})

		if err != nil {
			h.App.Logger.Error().Err(err).Msg("ffmpegutil: Error durante la instalación de FFmpeg")
			h.App.WSEventManager.SendEvent(events.ErrorToast, fmt.Sprintf("Error instalando FFmpeg: %v", err))
			h.App.WSEventManager.SendEvent("ffmpeg-download-progress", map[string]interface{}{
				"progress": 0,
				"status":   "Error en la instalación",
				"error":    err.Error(),
			})
		} else {
			h.App.Logger.Info().Msg("ffmpegutil: FFmpeg y FFprobe instalados y listos")
			h.App.WSEventManager.SendEvent(events.SuccessToast, "FFmpeg y FFprobe instalados correctamente")
			h.App.WSEventManager.SendEvent("ffmpeg-download-progress", map[string]interface{}{
				"progress": 100,
				"status":   "Instalado correctamente",
			})
			if mSettings, ok := h.App.Database.GetMediastreamSettings(); ok {
				h.App.MediastreamRepository.InitializeModules(mSettings, h.App.Config.Cache.Dir, h.App.Config.Cache.TranscodeDir)
			}
		}
	}()

	return h.RespondWithData(c, map[string]interface{}{
		"started": true,
	})
}
