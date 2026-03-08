package nakama

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/customsource"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/directstream"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util"
	"kamehouse/internal/videocore"
	"strconv"
	"strings"
	"time"

	"github.com/imroc/req/v3"
)

type (
	HydrateHostAnimeLibraryOptions struct {
		AnimeCollection     *anilist.AnimeCollection
		LibraryCollection   *anime.LibraryCollection
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
	}

	NakamaAnimeLibrary struct {
		LocalFiles      []*dto.LocalFile         `json:"localFiles"`
		AnimeCollection *anilist.AnimeCollection `json:"animeCollection"`
	}

	NakamaCustomSourceMap map[int]string

	NakamaLocalFiles struct {
		LocalFiles []*dto.LocalFile `json:"localFiles"`
		// CustomSourceMap maps a generated ID to custom source extension ID
		CustomSourceMap NakamaCustomSourceMap `json:"customSourceMap"`
	}
)

// generateHMACToken generates an HMAC token for stream authentication
func (m *Manager) generateHMACToken(endpoint string) (string, error) {
	// Use the Nakama password as the base secret - HostPassword for hosts, RemoteServerPassword for peers
	var secret string
	if m.settings.IsHost {
		secret = m.settings.HostPassword
	} else {
		secret = m.settings.RemoteServerPassword
	}

	hmacAuth := util.NewHMACAuth(secret, 24*time.Hour)
	return hmacAuth.GenerateToken(endpoint)
}

func (m *Manager) GetHostAnimeLibraryFiles(ctx context.Context, mId ...int) (lfs []*dto.LocalFile, customSourceMap NakamaCustomSourceMap, hydrated bool) {
	if !m.settings.Enabled || !m.settings.IncludeNakamaAnimeLibrary || !m.IsConnectedToHost() || m.IsRoomConnection() {
		return nil, nil, false
	}

	// If we're trying to fetch a custom extension, get the entire local files instead
	// This is because the custom source media ID is different on the host
	// The host will return all the shared local files and a map allowing us to pinpoint the local files that match the custom source media
	if len(mId) > 0 && customsource.IsExtensionId(mId[0]) {
		mId = []int{}
	}

	var response *req.Response
	var err error
	if len(mId) > 0 {
		response, err = m.reqClient.R().
			SetContext(ctx).
			SetHeader("X-KameHouse-Nakama-Token", m.settings.RemoteServerPassword).
			Get(m.GetHostBaseServerURL() + "/api/v1/nakama/host/anime/library/files/" + strconv.Itoa(mId[0]))
		if err != nil {
			return nil, nil, false
		}
	} else {
		response, err = m.reqClient.R().
			SetContext(ctx).
			SetHeader("X-KameHouse-Nakama-Token", m.settings.RemoteServerPassword).
			Get(m.GetHostBaseServerURL() + "/api/v1/nakama/host/anime/library/files")
		if err != nil {
			return nil, nil, false
		}
	}

	if !response.IsSuccessState() {
		return nil, nil, false
	}

	body := response.Bytes()

	var entryResponse struct {
		Data *NakamaLocalFiles `json:"data"`
	}
	err = json.Unmarshal(body, &entryResponse)
	if err != nil {
		return nil, nil, false
	}

	return entryResponse.Data.LocalFiles, entryResponse.Data.CustomSourceMap, true
}

func (m *Manager) GetHostAnimeLibrary(ctx context.Context) (ac *NakamaAnimeLibrary, hydrated bool) {
	if !m.settings.Enabled || !m.settings.IncludeNakamaAnimeLibrary || !m.IsConnectedToHost() || m.IsRoomConnection() {
		return nil, false
	}

	var response *req.Response
	var err error

	response, err = m.reqClient.R().
		SetContext(ctx).
		SetHeader("X-KameHouse-Nakama-Token", m.settings.RemoteServerPassword).
		Get(m.GetHostBaseServerURL() + "/api/v1/nakama/host/anime/library")
	if err != nil {
		return nil, false
	}

	if !response.IsSuccessState() {
		return nil, false
	}

	body := response.Bytes()

	var entryResponse struct {
		Data *NakamaAnimeLibrary `json:"data"`
	}
	err = json.Unmarshal(body, &entryResponse)
	if err != nil {
		return nil, false
	}

	if entryResponse.Data == nil {
		return nil, false
	}

	return entryResponse.Data, true
}

func (m *Manager) PlayHostAnimeLibraryFile(path string, userAgent string, clientId string, media *models.LibraryMedia, aniDBEpisode string, forcePlaybackMethod string) error {
	if !m.settings.Enabled || !m.IsConnectedToHost() || m.IsRoomConnection() {
		return errors.New("not connected to host")
	}

	m.previousPath = path

	m.logger.Debug().Int("mediaId", int(media.ID)).Msg("nakama: Playing host anime library file")
	m.wsEventManager.SendEvent(events.ShowIndefiniteLoader, "nakama-file")
	m.wsEventManager.SendEvent(events.InfoToast, "Sending stream to player...")

	// Send a HTTP request to the host to get the anime library
	// If we can access it then the host is sharing its anime library
	response, err := m.reqClient.R().
		SetHeader("X-KameHouse-Nakama-Token", m.settings.RemoteServerPassword).
		Get(m.GetHostBaseServerURL() + "/api/v1/nakama/host/anime/library/shared")
	if err != nil {
		return fmt.Errorf("cannot access host's anime library: %w", err)
	}

	if !response.IsSuccessState() {
		body := response.Bytes()
		code := response.StatusCode
		return fmt.Errorf("cannot access host's anime library: %d, %s", code, string(body))
	}

	host := m.serverHost
	if host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	address := fmt.Sprintf("%s:%d", host, m.serverPort)
	ret := fmt.Sprintf("http://%s/api/v1/nakama/stream?type=file&path=%s", address, base64.StdEncoding.EncodeToString([]byte(path)))
	if strings.HasPrefix(ret, "http://http") {
		ret = strings.Replace(ret, "http://http", "http", 1)
	}

	windowTitle := media.TitleOriginal
	if media.TitleEnglish != "" {
		windowTitle = media.TitleEnglish
	}
	if !media.IsMovieOrSingleEpisode() {
		windowTitle += " - Episode " + aniDBEpisode
	}

	err = m.directstreamManager.PlayNakamaStream(context.Background(), directstream.PlayNakamaStreamOptions{
		StreamUrl:          ret,
		MediaId:            int(media.ID),
		AnidbEpisode:       aniDBEpisode,
		Media:              media.ToAnilistBaseAnime(),
		NakamaHostPassword: m.settings.RemoteServerPassword,
		ClientId:           clientId,
	})
	if err != nil {
		m.wsEventManager.SendEvent(events.HideIndefiniteLoader, "nakama-file")
		return err
	}

	m.nativePlayer.VideoCore().RegisterEventCallback(func(event videocore.VideoEvent) bool {
		if !event.IsNakama() {
			return true // continue
		}
		switch event.(type) {
		case *videocore.VideoLoadedMetadataEvent, *videocore.VideoTerminatedEvent:
			m.wsEventManager.SendEvent(events.HideIndefiniteLoader, "nakama-file")
			return false
		}
		return true // continue
	})

	return nil
}

func (m *Manager) PlayHostAnimeStream(streamType WatchPartyStreamType, userAgent string, clientId string, media *models.LibraryMedia, aniDBEpisode string) error {
	if !m.settings.Enabled || !m.IsConnectedToHost() {
		return errors.New("not connected to host")
	}

	m.logger.Debug().Int("mediaId", int(media.ID)).Msg("nakama: Playing host anime stream")
	m.wsEventManager.SendEvent(events.ShowIndefiniteLoader, "nakama-stream")
	m.wsEventManager.SendEvent(events.InfoToast, "Sending stream to player...")

	host := m.serverHost
	if host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	address := fmt.Sprintf("%s:%d", host, m.serverPort)

	ret := fmt.Sprintf("http://%s/api/v1/nakama/stream?type=%s", address, string(streamType))
	if strings.HasPrefix(ret, "http://http") {
		ret = strings.Replace(ret, "http://http", "http", 1)
	}

	windowTitle := media.TitleOriginal
	if media.TitleEnglish != "" {
		windowTitle = media.TitleEnglish
	}
	if !media.IsMovieOrSingleEpisode() {
		windowTitle += " - Episode " + aniDBEpisode
	}

	err := m.directstreamManager.PlayNakamaStream(context.Background(), directstream.PlayNakamaStreamOptions{
		StreamUrl:          ret,
		MediaId:            int(media.ID),
		AnidbEpisode:       aniDBEpisode,
		Media:              media.ToAnilistBaseAnime(),
		NakamaHostPassword: m.settings.RemoteServerPassword,
		ClientId:           clientId,
	})
	if err != nil {
		m.wsEventManager.SendEvent(events.HideIndefiniteLoader, "nakama-stream")
		return err
	}

	m.nativePlayer.VideoCore().RegisterEventCallback(func(event videocore.VideoEvent) bool {
		if !event.IsNakama() {
			return true // keep listening
		}
		switch event.(type) {
		case *videocore.VideoLoadedMetadataEvent, *videocore.VideoTerminatedEvent:
			m.wsEventManager.SendEvent(events.HideIndefiniteLoader, "nakama-stream")
			return false // stop
		}
		return true // keep listening
	})

	return nil
}
