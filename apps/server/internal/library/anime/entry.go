package anime

import (
	"context"
	"errors"
	"fmt"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"sort"
	"strconv"
	"strings"
	"github.com/samber/lo"
	"github.com/sourcegraph/conc/pool"
)

type (
	// Entry is a container for all data related to a media.
	// It is the primary data structure used by the frontend.
	Entry struct {
		MediaId             int                     `json:"mediaId"`
		Media               *models.LibraryMedia    `json:"media"`
		EntryListData       *EntryListData          `json:"listData"`
		EntryLibraryData    *EntryLibraryData       `json:"libraryData"`
		EntryDownloadInfo   *EntryDownloadInfo      `json:"downloadInfo,omitempty"`
		Episodes            []*Episode              `json:"episodes"`
		NextEpisode         *Episode                `json:"nextEpisode"`
		LocalFiles          []*LocalFile            `json:"localFiles"`
		AnidbId             int                     `json:"anidbId"`
		CurrentEpisodeCount int                     `json:"currentEpisodeCount"`
		Seasons             []*models.LibrarySeason `json:"seasons,omitempty"`
	}

	// EntryListData holds the details of the platform entry (TMDb/MAL/etc).
	EntryListData struct {
		Progress    int     `json:"progress,omitempty"`
		Score       float64 `json:"score,omitempty"`
		Status      string  `json:"status,omitempty"`
		Repeat      int     `json:"repeat,omitempty"`
		StartedAt   string  `json:"startedAt,omitempty"`
		CompletedAt string  `json:"completedAt,omitempty"`
	}
)

type (
	// NewEntryOptions is a constructor for Entry.
	NewEntryOptions struct {
		MediaId             int
		LocalFiles          []*LocalFile // All local files
		Database            *db.Database
		PlatformRef         *util.Ref[platform.Platform]
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
		IsSimulated         bool // If the account is simulated
		LibraryEpisodes     map[string]*models.LibraryEpisode
	}
)

// NewEntry creates a new Entry based on the media id and a list of local files.
// A Entry is a container for all data related to a media.
// It is the primary data structure used by the frontend.
//
// It has the following properties:
//   - EntryListData: Details of the platform entry (if any)
//   - EntryLibraryData: Details of the local files (if any)
//   - EntryDownloadInfo: Details of the download status
//   - Episodes: List of episodes (if any)
//   - NextEpisode: Next episode to watch (if any)
//   - LocalFiles: List of local files (if any)
//   - AnidbId: AniDB id
//   - CurrentEpisodeCount: Current episode count
func NewEntry(ctx context.Context, opts *NewEntryOptions) (*Entry, error) {
	// Create new Entry
	entry := new(Entry)
	entry.MediaId = opts.MediaId



	if opts.Database == nil || opts.PlatformRef.IsAbsent() {
		return nil, errors.New("missing arguments when creating media entry")
	}

	// +---------------------+
	// |   Local Database    |
	// +---------------------+

	// Fetch the media from local database
	var fetchedMedia *models.LibraryMedia

	// Try looking it up by TMDB ID
	m, err := db.GetLibraryMediaByTmdbId(opts.Database, opts.MediaId)
	if err == nil && m != nil {
		fetchedMedia = m
	}

	// If direct lookup or TMDB lookup failed,
	// find the LibraryMediaId from local files
	if fetchedMedia == nil {
		for _, lf := range opts.LocalFiles {
			if lf.MediaId == opts.MediaId && lf.LibraryMediaId > 0 {
				m, err := db.GetLibraryMediaByID(opts.Database, lf.LibraryMediaId)
				if err == nil && m != nil {
					fetchedMedia = m
					break
				}
			}
		}
	}

	if fetchedMedia == nil {
		return nil, errors.New("could not find library media in database")
	}
	entry.Media = fetchedMedia

	// Fetch the seasons for this media, if any
	var dbSeasons []models.LibrarySeason
	err = opts.Database.Gorm().Where("library_media_id = ?", fetchedMedia.ID).Order("season_number ASC").Find(&dbSeasons).Error
	if err == nil && len(dbSeasons) > 0 {
		entry.Seasons = make([]*models.LibrarySeason, len(dbSeasons))
		for i := range dbSeasons {
			entry.Seasons[i] = &dbSeasons[i]
		}
	}

	entry.CurrentEpisodeCount = 0 // Locally we don't track total count at the Series level right now unless we check episodes

	// +---------------------+
	// |     Local files     |
	// +---------------------+

	// Get the entry's local files
	lfs := GetLocalFilesFromMediaId(opts.LocalFiles, opts.MediaId)
	entry.LocalFiles = lfs // Returns empty slice if no local files are found

	listData, _ := db.GetMediaEntryListData(opts.Database, fetchedMedia.ID)

	progress := 0
	if listData != nil {
		progress = listData.Progress
		entry.EntryListData = &EntryListData{
			Progress:    listData.Progress,
			Score:       listData.Score,
			Status:      listData.Status,
			Repeat:      listData.Repeat,
			StartedAt:   listData.StartedAt,
			CompletedAt: listData.CompletedAt,
		}
	} else {
		entry.EntryListData = &EntryListData{
			Status: "PLANNING",
		}
	}

	libraryData, _ := NewEntryLibraryData(&NewEntryLibraryDataOptions{
		EntryLocalFiles: lfs,
		MediaId:         opts.MediaId,
		CurrentProgress: progress,
	})
	entry.EntryLibraryData = libraryData

	// Fetch library episodes from the DB to override episode metadata
	if opts.LibraryEpisodes == nil {
		var dbEpisodes []*models.LibraryEpisode
		err = opts.Database.Gorm().Where("library_media_id = ?", fetchedMedia.ID).Find(&dbEpisodes).Error
		if err == nil && len(dbEpisodes) > 0 {
			opts.LibraryEpisodes = make(map[string]*models.LibraryEpisode)
			for _, ep := range dbEpisodes {
				key := fmt.Sprintf("%d-%d", ep.SeasonNumber, ep.EpisodeNumber)
				opts.LibraryEpisodes[key] = ep
			}
		}
	}

	// +---------------------+
	// |       Animap        |
	// +---------------------+

	// Fetch AniDB data and cache it for 30 minutes
	animeMetadata, err := opts.MetadataProviderRef.Get().GetAnimeMetadata(opts.MediaId)
	if err != nil {

		// +---------------- Start
		// +---------------------+
		// |   Without Animap    |
		// +---------------------+

		// If Animap data is not found, we will still create the Entry without it
		simpleAnimeEntry, err := NewSimpleEntry(ctx, &NewSimpleAnimeEntryOptions{
			MediaId:             opts.MediaId,
			LocalFiles:          opts.LocalFiles,
			Database:            opts.Database,
			PlatformRef:         opts.PlatformRef,
			MetadataProviderRef: opts.MetadataProviderRef,
			LibraryEpisodes:     opts.LibraryEpisodes,
		})
		if err != nil {
			return nil, err
		}

		return &Entry{
			MediaId:             simpleAnimeEntry.MediaId,
			Media:               simpleAnimeEntry.Media,
			EntryListData:       simpleAnimeEntry.EntryListData,
			EntryLibraryData:    simpleAnimeEntry.EntryLibraryData,
			EntryDownloadInfo:   nil,
			Episodes:            simpleAnimeEntry.Episodes,
			NextEpisode:         simpleAnimeEntry.NextEpisode,
			LocalFiles:          simpleAnimeEntry.LocalFiles,
			AnidbId:             0,
			CurrentEpisodeCount: simpleAnimeEntry.CurrentEpisodeCount,
		}, nil
		// +--------------- End

	}

	entry.AnidbId = animeMetadata.GetMappings().AnidbId

	// +---------------------+
	// |       Episodes      |
	// +---------------------+

	// Create episode entities
	entry.hydrateEntryEpisodeData(listData, animeMetadata, opts.MetadataProviderRef, opts.LibraryEpisodes)

	return entry, nil
}

//----------------------------------------------------------------------------------------------------------------------

// hydrateEntryEpisodeData
// Metadata, Media and LocalFiles should be defined
func (e *Entry) hydrateEntryEpisodeData(
	listData *models.MediaEntryListData,
	animeMetadata *metadata.AnimeMetadata,
	metadataProviderRef *util.Ref[metadata_provider.Provider],
	libraryEpisodes map[string]*models.LibraryEpisode,
) {

	if animeMetadata == nil || (animeMetadata.Episodes == nil && len(animeMetadata.Episodes) == 0) {
		return
	}

	// +---------------------+
	// |     Discrepancy     |
	// +---------------------+

	// We offset the progress number by 1 if there is a discrepancy
	progressOffset := 0
	if FindDiscrepancy(e.Media, animeMetadata) == DiscrepancyPlatformCountsEpisodeZero {
		progressOffset = 1

		_, ok := lo.Find(e.LocalFiles, func(lf *LocalFile) bool {
			return lf.Metadata.Episode == 0
		})
		// Remove the offset if episode 0 is not found
		if !ok {
			progressOffset = 0
		}
	}

	// Pass nil as platform.UnifiedMedia since we are moving away from legacy provider types
	amw := metadataProviderRef.Get().GetAnimeMetadataWrapper(nil, animeMetadata)

	// +---------------------+
	// |       Episodes      |
	// +---------------------+

	// Group local files by Season-Episode for intelligently grouping multi-versions
	groupedFiles := make(map[string][]*LocalFile)
	for _, lf := range e.LocalFiles {
		// Support multi-part episode vectors
		episodes := []int{lf.GetEpisodeNumber()}
		if lf.ParsedData != nil && len(lf.ParsedData.EpisodeRange) > 1 {
			episodes = []int{}
			for _, epStr := range lf.ParsedData.EpisodeRange {
				if epNum, err := strconv.Atoi(epStr); err == nil {
					episodes = append(episodes, epNum)
				}
			}
		}

		seasonNum := lf.GetSeasonNumber()
		if lf.GetType() == LocalFileTypeSpecial {
			seasonNum = 0
		}

		for _, epNum := range episodes {
			key := fmt.Sprintf("%d-%d", seasonNum, epNum)
			groupedFiles[key] = append(groupedFiles[key], lf)
		}
	}

	// NEW LOGIC: Pad missing canonical episodes for the frontend
	if animeMetadata != nil && animeMetadata.Episodes != nil {
		for _, epMeta := range animeMetadata.Episodes {
			// Only pad main episodes and specials (Season 0 or Season 1/2) that have an episode number
			if epMeta.EpisodeNumber > 0 {
				seasonNum := epMeta.SeasonNumber
				if strings.HasPrefix(epMeta.Episode, "S") {
					seasonNum = 0
				} else if seasonNum == 0 {
					seasonNum = 1 // Default main season
				}

				key := fmt.Sprintf("%d-%d", seasonNum, epMeta.EpisodeNumber)
				if _, exists := groupedFiles[key]; !exists {
					groupedFiles[key] = []*LocalFile{} // Empty slice for missing episode
				}
			}
		}
	}

	p := pool.NewWithResults[*Episode]()
	for key, lfs := range groupedFiles {
		lfs := lfs
		keyParts := strings.Split(key, "-")
		seasonTarget, _ := strconv.Atoi(keyParts[0])
		episodeTarget, _ := strconv.Atoi(keyParts[1])

		p.Go(func() *Episode {
			var primaryLf *LocalFile
			var isDownloaded bool
			var aniDBEpStr string

			if len(lfs) > 0 {
				primaryLf = lfs[0]
				isDownloaded = true
				// Override Episode Number in metadata if it was expanded from range
				primaryLf.Metadata.Episode = episodeTarget
			} else {
				isDownloaded = false
				if seasonTarget == 0 {
					aniDBEpStr = "S" + strconv.Itoa(episodeTarget)
				} else {
					aniDBEpStr = strconv.Itoa(episodeTarget)
				}
			}

			var libEp *models.LibraryEpisode
			if libraryEpisodes != nil {
				key := fmt.Sprintf("%d-%d", seasonTarget, episodeTarget)
				if ep, ok := libraryEpisodes[key]; ok {
					libEp = ep
				}
			}

			ep := NewEpisode(&NewEpisodeOptions{
				LocalFile:            primaryLf,
				MetadataWrapper:      amw,
				OptionalAniDBEpisode: aniDBEpStr,
				AnimeMetadata:        animeMetadata,
				Media:                e.Media,
				ProgressOffset:       progressOffset,
				IsDownloaded:         isDownloaded,
				MetadataProvider:     metadataProviderRef.Get(),
				LibraryEpisode:       libEp,
			})

			if len(lfs) > 1 {
				ep.AdditionalFiles = lfs[1:]
			}

			return ep
		})
	}
	episodes := p.Wait()
	// Sort by progress number
	sort.Slice(episodes, func(i, j int) bool {
		return episodes[i].EpisodeNumber < episodes[j].EpisodeNumber
	})
	e.Episodes = episodes

	// +---------------------+
	// |    Download Info    |
	// +---------------------+

	progress := 0
	status := ""
	if listData != nil {
		progress = listData.Progress
		status = listData.Status
	}

	info, err := NewEntryDownloadInfo(&NewEntryDownloadInfoOptions{
		LocalFiles:          e.LocalFiles,
		AnimeMetadata:       animeMetadata,
		Progress:            progress,
		Status:              status,
		Media:               e.Media,
		MetadataProviderRef: metadataProviderRef,
	})
	if err == nil {
		e.EntryDownloadInfo = info
	}

	nextEp, found := e.FindNextEpisode()
	if found {
		e.NextEpisode = nextEp
	}

}

func NewEntryListData(listData *models.MediaEntryListData) *EntryListData {
	return &EntryListData{
		Progress:    listData.Progress,
		Score:       listData.Score,
		Status:      listData.Status,
		Repeat:      listData.Repeat,
		StartedAt:   listData.StartedAt,
		CompletedAt: listData.CompletedAt,
	}
}

//----------------------------------------------------------------------------------------------------------------------

type Discrepancy int

const (
	DiscrepancyPlatformCountsEpisodeZero Discrepancy = iota
	DiscrepancyPlatformCountsSpecials
	DiscrepancyAniDBHasMore
	DiscrepancyNone
)

func FindDiscrepancy(media *models.LibraryMedia, animeMetadata *metadata.AnimeMetadata) Discrepancy {
	if media == nil || animeMetadata == nil || animeMetadata.Episodes == nil {
		return DiscrepancyNone
	}

	_, aniDBHasS1 := animeMetadata.Episodes["S1"]
	_, aniDBHasS2 := animeMetadata.Episodes["S2"]

	difference := 0 // TODO: Get expected total episodes if needed here
	if difference == 0 {
		return DiscrepancyNone
	}

	if difference < 0 {
		return DiscrepancyAniDBHasMore
	}

	if difference == 1 && aniDBHasS1 {
		return DiscrepancyPlatformCountsEpisodeZero
	}

	if difference > 1 && aniDBHasS1 && aniDBHasS2 {
		return DiscrepancyPlatformCountsSpecials
	}

	return DiscrepancyNone
}
