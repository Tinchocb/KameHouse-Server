package extension_playground

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/events"
	"kamehouse/internal/extension"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"runtime"
	"strings"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/rs/zerolog"
)

type (
	PlaygroundRepository struct {
		logger              *zerolog.Logger
		platformRef         *util.Ref[platform.Platform]
		baseAnimeCache      *result.Cache[int, *anilist.BaseAnime]
		baseMangaCache      *result.Cache[int, *anilist.BaseManga]
		metadataProviderRef *util.Ref[metadata_provider.Provider]
		wsEventManager      events.WSEventManagerInterface
	}

	RunPlaygroundCodeResponse struct {
		Logs  string `json:"logs"`
		Value string `json:"value"`
	}

	RunPlaygroundCodeParams struct {
		Type     extension.Type         `json:"type"`
		Language extension.Language     `json:"language"`
		Code     string                 `json:"code"`
		Inputs   map[string]interface{} `json:"inputs"`
		Function string                 `json:"function"`
	}
)

func NewPlaygroundRepository(logger *zerolog.Logger, platformRef *util.Ref[platform.Platform], metadataProviderRef *util.Ref[metadata_provider.Provider]) *PlaygroundRepository {
	return &PlaygroundRepository{
		logger:              logger,
		platformRef:         platformRef,
		metadataProviderRef: metadataProviderRef,
		baseAnimeCache:      result.NewCache[int, *anilist.BaseAnime](),
		baseMangaCache:      result.NewCache[int, *anilist.BaseManga](),
		wsEventManager:      events.NewMockWSEventManager(logger),
	}
}

func (r *PlaygroundRepository) RunPlaygroundCode(params *RunPlaygroundCodeParams) (resp *RunPlaygroundCodeResponse, err error) {
	defer util.HandlePanicInModuleWithError("extension_playground/RunPlaygroundCode", &err)

	if params == nil {
		return nil, fmt.Errorf("no parameters provided")
	}

	ext := &extension.Extension{
		ID:          "playground-extension",
		Name:        "Playground",
		Version:     "0.0.0",
		ManifestURI: "",
		Language:    params.Language,
		Type:        params.Type,
		Description: "",
		Author:      "",
		Icon:        "",
		Website:     "",
		Payload:     params.Code,
	}

	r.logger.Debug().Msgf("playground: Inputs: %s", strings.ReplaceAll(spew.Sprint(params.Inputs), "\n", ""))

	switch params.Type {
	case extension.TypeMangaProvider:
		return r.runPlaygroundCodeMangaProvider(ext, params)
	case extension.TypeOnlinestreamProvider:
		return r.runPlaygroundCodeOnlinestreamProvider(ext, params)
	case extension.TypeAnimeTorrentProvider:
		return r.runPlaygroundCodeAnimeTorrentProvider(ext, params)
	default:
	}

	runtime.GC()

	return nil, fmt.Errorf("invalid extension type")
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type PlaygroundDebugLogger struct {
	logger *zerolog.Logger
	buff   *bytes.Buffer
}

func (r *PlaygroundRepository) newPlaygroundDebugLogger() *PlaygroundDebugLogger {
	buff := bytes.NewBuffer(nil)
	consoleWritier := zerolog.ConsoleWriter{
		Out:           buff,
		TimeFormat:    time.DateTime,
		FormatMessage: util.ZerologFormatMessageSimple,
		FormatLevel:   util.ZerologFormatLevelSimple,
		NoColor:       true, // Needed to prevent color codes from being written to the file
	}

	logger := zerolog.New(consoleWritier).With().Timestamp().Logger()

	return &PlaygroundDebugLogger{
		logger: &logger,
		buff:   buff,
	}
}

func newPlaygroundResponse(playgroundLogger *PlaygroundDebugLogger, value interface{}) *RunPlaygroundCodeResponse {
	v := ""

	switch value.(type) {
	case error:
		v = fmt.Sprintf("ERROR: %+v", value)
	case string:
		v = value.(string)
	default:
		// Pretty print the value to json
		prettyJSON, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			v = fmt.Sprintf("ERROR: Failed to marshal value to JSON: %+v", err)
		} else {
			v = string(prettyJSON)
		}
	}

	logs := playgroundLogger.buff.String()

	return &RunPlaygroundCodeResponse{
		Logs:  logs,
		Value: v,
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *PlaygroundRepository) getAnime(mediaId int) (anime *anilist.BaseAnime, am *metadata.AnimeMetadata, err error) {
	var ok bool
	anime, ok = r.baseAnimeCache.Get(mediaId)
	if !ok {
		anime, err = r.platformRef.Get().GetAnime(context.Background(), mediaId)
		if err != nil {
			return nil, nil, err
		}
		r.baseAnimeCache.SetT(mediaId, anime, 24*time.Hour)
	}

	am, _ = r.metadataProviderRef.Get().GetAnimeMetadata(metadata.AnilistPlatform, mediaId)
	return anime, am, nil
}

func (r *PlaygroundRepository) getManga(mediaId int) (manga *anilist.BaseManga, err error) {
	var ok bool
	manga, ok = r.baseMangaCache.Get(mediaId)
	if !ok {
		manga, err = r.platformRef.Get().GetManga(context.Background(), mediaId)
		if err != nil {
			return nil, err
		}
		r.baseMangaCache.SetT(mediaId, manga, 24*time.Hour)
	}
	return
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (r *PlaygroundRepository) runPlaygroundCodeAnimeTorrentProvider(ext *extension.Extension, params *RunPlaygroundCodeParams) (resp *RunPlaygroundCodeResponse, err error) {
	playgroundLogger := r.newPlaygroundDebugLogger()
	return newPlaygroundResponse(playgroundLogger, fmt.Errorf("JS extensions are no longer supported")), nil
}

func (r *PlaygroundRepository) runPlaygroundCodeMangaProvider(ext *extension.Extension, params *RunPlaygroundCodeParams) (resp *RunPlaygroundCodeResponse, err error) {
	playgroundLogger := r.newPlaygroundDebugLogger()
	return newPlaygroundResponse(playgroundLogger, fmt.Errorf("JS extensions are no longer supported")), nil
}

func (r *PlaygroundRepository) runPlaygroundCodeOnlinestreamProvider(ext *extension.Extension, params *RunPlaygroundCodeParams) (resp *RunPlaygroundCodeResponse, err error) {
	playgroundLogger := r.newPlaygroundDebugLogger()
	return newPlaygroundResponse(playgroundLogger, fmt.Errorf("JS extensions are no longer supported")), nil
}
