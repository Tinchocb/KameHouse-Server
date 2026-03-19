package handlers

import (
	"context"
	"errors"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/hook"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/library/scanner"

	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util/result"
	"os"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/samber/lo"
)

func getActiveProvider(h *Handler) librarymetadata.Provider {
	var useTMDB bool
	var tmdbToken string
	var tmdbLanguage string
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		useTMDB = settings.Library.ScannerProvider == "tmdb"
		tmdbToken = settings.Library.TmdbApiKey
		tmdbLanguage = settings.Library.TmdbLanguage
	}
	if tmdbToken == "" {
		tmdbToken = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
	}

	if useTMDB {
		if tmdbToken != "" {
			return librarymetadata.NewTMDBProvider(tmdbToken, tmdbLanguage)
		} else {
			h.App.Logger.Warn().Msg("handlers: TMDB mode requested but TMDB token not set")
		}
	}

	return nil
}

func (h *Handler) getAnimeEntry(c echo.Context, lfs []*dto.LocalFile, mId int) (*anime.Entry, error) {
	//

	// Anime collection is no longer used for getting entries

	// Create a new media entry
	entry, err := anime.NewEntry(c.Request().Context(), &anime.NewEntryOptions{
		MediaId:             mId,
		LocalFiles:          lfs,
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.PlatformRef,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
		IsSimulated:         h.App.GetUser() != nil && h.App.GetUser().IsSimulated,
	})
	if err != nil {
		return nil, err
	}

	fillerEvent := new(anime.AnimeEntryFillerHydrationEvent)
	fillerEvent.Entry = entry
	err = hook.GlobalHookManager.OnAnimeEntryFillerHydration().Trigger(fillerEvent)
	if err != nil {
		return nil, h.RespondWithError(c, err)
	}
	entry = fillerEvent.Entry

	if !fillerEvent.DefaultPrevented {
		h.App.FillerManager.HydrateFillerData(fillerEvent.Entry)
	}

	return entry, nil
}

// HandleGetAnimeEntry
//
//	@summary return a media entry for the given anime media id.
//	@desc This is used by the anime media entry pages to get all the data about the anime.
//	@desc This includes episodes and metadata (if any), list data, download info...
//	@route /api/v1/library/anime-entry/{id} [GET]
//	@param id - int - true - "Anime media ID"
//	@returns anime.Entry
func (h *Handler) HandleGetAnimeEntry(c echo.Context) error {
	idParam := c.Param("id")
	mId, err := strconv.Atoi(idParam)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	entry, err := h.getAnimeEntry(c, lfs, mId)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, entry)
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

var entriesSuggestionsCache = result.NewCache[string, []*platform.UnifiedMedia]()

// HandleGetAnimeEntrySuggestions
//
//	@summary returns anime suggestions for the given local files.
//	@desc This is used when the user wants to manually match local files to an anime.
//	@desc It returns a list of anime suggestions based on the titles of the local files.
//	@route /api/v1/library/anime-entry/suggestions [POST]
//	@param paths - []string - true - "Paths of the local files"
//	@returns []*platform.UnifiedMedia
func (h *Handler) HandleGetAnimeEntrySuggestions(c echo.Context) error {

	type body struct {
		Paths []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	if len(b.Paths) == 0 {
		return h.RespondWithError(c, errors.New("no paths provided"))
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	selectedLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lo.Contains(b.Paths, lf.Path)
	})

	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given paths"))
	}

	title := selectedLfs[0].GetParsedTitle()

	if res, ok := entriesSuggestionsCache.Get(title); ok {
		return h.RespondWithData(c, res)
	}

	h.App.Logger.Info().Str("title", title).Msg("handlers: Fetching anime suggestions")

	provider := librarymetadata.NewTMDBProviderWithClient(h.App.Metadata.TMDBClient)

	res, err := provider.SearchMedia(c.Request().Context(), title)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Fake UnifiedMedia array for frontend compatibility
	var newSuggestions []*platform.UnifiedMedia
	for _, nm := range res {
		title := &platform.MediaTitle{}
		if nm.Title != nil {
			title.English = nm.Title.English
			title.Romaji = nm.Title.Romaji
			title.Native = nm.Title.Native
		}

		var cover *platform.MediaCoverImage
		if nm.CoverImage != nil {
			cover = &platform.MediaCoverImage{
				ExtraLarge: nm.CoverImage.ExtraLarge,
				Large:      nm.CoverImage.Large,
				Medium:     nm.CoverImage.Medium,
				Color:      nm.CoverImage.Color,
			}
		}

		var startDate *platform.FuzzyDate
		if nm.StartDate != nil {
			startDate = &platform.FuzzyDate{
				Year:  nm.StartDate.Year,
				Month: nm.StartDate.Month,
				Day:   nm.StartDate.Day,
			}
		}

		var format platform.MediaFormat
		if nm.Format != nil {
			format = platform.MediaFormat(*nm.Format)
		}

		var status platform.MediaStatus
		if nm.Status != nil {
			status = platform.MediaStatus(*nm.Status)
		}

		newSuggestions = append(newSuggestions, &platform.UnifiedMedia{
			ID:         nm.ID,
			Title:      title,
			CoverImage: cover,
			Format:     format,
			StartDate:  startDate,
			Status:     status,
		})
	}

	entriesSuggestionsCache.SetT(title, newSuggestions, 1*time.Hour)

	return h.RespondWithData(c, newSuggestions)
}

// HandleUpdateAnimeEntryProgress
//
//	@summary updates the progress of an anime entry.
//	@desc This is used when the user manually updates the progress of an anime.
//	@route /api/v1/library/anime-entry/progress [POST]
//	@param mediaId - int - true - "Anime media ID"
//	@param progress - int - true - "New progress"
//	@returns bool
func (h *Handler) HandleUpdateAnimeEntryProgress(c echo.Context) error {

	type body struct {
		MediaId  int `json:"mediaId"`
		Progress int `json:"progress"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.Metadata.PlatformRef.Get().UpdateEntryProgress(c.Request().Context(), b.MediaId, b.Progress, nil)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}

// HandleUpdateAnimeEntryRepeat
//
//	@summary updates the repeat count of an anime entry.
//	@desc This is used when the user manually updates the repeat count of an anime.
//	@route /api/v1/library/anime-entry/repeat [POST]
//	@param mediaId - int - true - "Anime media ID"
//	@param repeat - int - true - "New repeat count"
//	@returns bool
func (h *Handler) HandleUpdateAnimeEntryRepeat(c echo.Context) error {

	type body struct {
		MediaId int `json:"mediaId"`
		Repeat  int `json:"repeat"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.Metadata.PlatformRef.Get().UpdateEntryRepeat(c.Request().Context(), b.MediaId, b.Repeat)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}

// HandleManualMatch is used to manually match a group of local files to a media.
// It will create a new scanner and run it for the selected files.
func (h *Handler) HandleManualMatch(c echo.Context) error {
	type body struct {
		MediaId int      `json:"mediaId"`
		Paths   []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get the local files that are being matched
	selectedLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lo.Contains(b.Paths, lf.Path)
	})
	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given paths"))
	}

	// Create scan logger
	scanLogger, err := scanner.NewScanLogger(h.App.Config.Logs.Dir)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Create a new scanner
	scn := &scanner.Scanner{
		DirPath:             "",
		OtherDirPaths:       nil,
		Enhanced:            false,
		PlatformRef:         h.App.Metadata.PlatformRef,
		Logger:              h.App.Logger,
		WSEventManager:      h.App.WSEventManager,
		ExistingLocalFiles:  lfs,
		SkipLockedFiles:     true,
		SkipIgnoredFiles:    true,
		ScanLogger:          scanLogger,
		Database:            h.App.Database,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
		UseLegacyMatching:   false,
		WithShelving:        false,
		UseTMDB:             h.App.Settings.Library.ScannerProvider == "tmdb",
		EventDispatcher:     h.App.WSEventManager.Dispatcher(),
	}

	// Run the scanner for the selected files
	_, err = scn.Scan(c.Request().Context())

	if err != nil {

		return h.RespondWithError(c, err)
	}



	// Refresh the collection
	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}

// HandleUnmatchFiles will unmatch the given local files.
// It will set the mediaId of the files to 0 and remove the metadata.
func (h *Handler) HandleUnmatchFiles(c echo.Context) error {
	type body struct {
		Paths []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get the local files that are being unmatched
	selectedLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lo.Contains(b.Paths, lf.Path)
	})
	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given paths"))
	}

	// Unmatch the files
	for _, lf := range selectedLfs {
		lf.MediaId = 0
		lf.Metadata = nil
		lf.Locked = false
		lf.Ignored = false
	}

	// Save local files
	_, err = db.SaveLocalFiles(h.App.Database, 1, selectedLfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}



	return h.RespondWithData(c, true)
}

// HandleDeletePlatformEntry will delete the given media entry from Platform.
func (h *Handler) HandleDeletePlatformEntry(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Delete the entry from the user's collection
	if err := h.App.Metadata.PlatformRef.Get().DeleteEntry(c.Request().Context(), b.MediaId, b.MediaId); err != nil {
		return h.RespondWithError(c, errors.New("error: Platform responded with an error, this is most likely a rate limit issue"))
	}
	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}



// HandleGetMissingEpisodes
//
//	@summary returns a list of missing episodes.
//	@desc This is used by the "Missing episodes" page to display the missing episodes.
//	@route /api/v1/library/missing-episodes [GET]
//	@returns anime.MissingEpisodes
func (h *Handler) HandleGetMissingEpisodes(c echo.Context) error {
	mIds, _ := h.App.Database.GetSilencedMediaEntryIds()

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	missing := anime.NewMissingEpisodes(&anime.NewMissingEpisodesOptions{
		Database:            h.App.Database,
		LocalFiles:          lfs,
		SilencedMediaIds:    mIds,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
	})

	return h.RespondWithData(c, missing)
}

// HandleSilenceMissingEpisodes will silence the missing episodes for the given media.
func (h *Handler) HandleSilenceMissingEpisodes(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	if err := h.App.Database.InsertSilencedMediaEntry(uint(b.MediaId)); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

// HandleGetUpcomingEpisodes
//
//	@summary returns a list of upcoming episodes.
//	@desc This is used by the "Upcoming" page to display the upcoming episodes.
//	@route /api/v1/library/upcoming-episodes [GET]
//	@returns anime.UpcomingEpisodes
func (h *Handler) HandleGetUpcomingEpisodes(c echo.Context) error {
	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	upcoming := anime.NewUpcomingEpisodes(&anime.NewUpcomingEpisodesOptions{
		AnimeCollection:     animeCollection,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
	})

	return h.RespondWithData(c, upcoming)
}
