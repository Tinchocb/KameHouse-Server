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

	"github.com/sourcegraph/conc/pool"
)

type (
	SimpleEntry struct {
		MediaId             int                  `json:"mediaId"`
		Media               *models.LibraryMedia `json:"media"`
		EntryListData       *EntryListData       `json:"listData"`
		EntryLibraryData    *EntryLibraryData    `json:"libraryData"`
		Episodes            []*Episode           `json:"episodes"`
		NextEpisode         *Episode             `json:"nextEpisode"`
		LocalFiles          []*LocalFile         `json:"localFiles"`
		AnidbId             int                  `json:"anidbId"`
		MalId               int                  `json:"malId"`
		CurrentEpisodeCount int                  `json:"currentEpisodeCount"`
		Vibes               []string             `json:"vibes,omitempty"`
		IntelligenceSvc     *IntelligenceService `json:"-"`
	}

	SimpleEntryListData struct {
		Progress    int     `json:"progress,omitempty"`
		Score       float64 `json:"score,omitempty"`
		Status      string  `json:"status,omitempty"`
		StartedAt   string  `json:"startedAt,omitempty"`
		CompletedAt string  `json:"completedAt,omitempty"`
	}

	NewSimpleAnimeEntryOptions struct {
		MediaId             int
		LocalFiles          []*LocalFile // All local files
		Database            *db.Database
		PlatformRef         *util.Ref[platform.Platform]
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
		LibraryEpisodes     map[string]*models.LibraryEpisode
		IntelligenceSvc     *IntelligenceService
	}
)

func NewSimpleEntry(ctx context.Context, opts *NewSimpleAnimeEntryOptions) (*SimpleEntry, error) {

	if opts.Database == nil ||
		opts.PlatformRef.IsAbsent() {
		return nil, errors.New("missing arguments when creating simple media entry")
	}
	// Create new Entry
	entry := new(SimpleEntry)
	entry.MediaId = opts.MediaId
	entry.IntelligenceSvc = opts.IntelligenceSvc

	// Get local DB media
	var fetchedMedia *models.LibraryMedia

	// Try direct lookup by potential PK
	fetchedMedia, _ = db.GetLibraryMediaByID(opts.Database, uint(opts.MediaId))

	// If not found, try looking it up by TMDB ID
	if fetchedMedia == nil {
		m, err := db.GetLibraryMediaByTmdbId(opts.Database, opts.MediaId)
		if err == nil && m != nil {
			fetchedMedia = m
		}
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
		return nil, errors.New("media not found in local db")
	}
	entry.Media = fetchedMedia
	entry.AnidbId = int(fetchedMedia.AnidbId)
	entry.MalId = int(fetchedMedia.MyanimelistId)
	entry.CurrentEpisodeCount = 0
	if opts.IntelligenceSvc != nil {
		entry.Vibes = opts.IntelligenceSvc.DeriveSeriesVibes(fetchedMedia)
	}

	// +---------------------+
	// |   Local files       |
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
		MediaId:         int(entry.Media.ID),
		CurrentProgress: progress,
	})
	entry.EntryLibraryData = libraryData

	// +---------------------+
	// |       Episodes      |
	// +---------------------+

	amw := opts.MetadataProviderRef.Get().GetAnimeMetadataWrapper(nil, nil)

	// Create episode entities
	entry.hydrateEntryEpisodeData(amw, opts.LibraryEpisodes)

	return entry, nil

}

//----------------------------------------------------------------------------------------------------------------------

// hydrateEntryEpisodeData
// Metadata, Media and LocalFiles should be defined
func (e *SimpleEntry) hydrateEntryEpisodeData(amw metadata_provider.AnimeMetadataWrapper, libraryEpisodes map[string]*models.LibraryEpisode) {

	// +---------------------+
	// |       Episodes      |
	// +---------------------+

	p := pool.NewWithResults[*Episode]()
	for _, lf := range e.LocalFiles {
		lf := lf
		p.Go(func() *Episode {
			seasonNum := 1
			if lf != nil {
				seasonNum = lf.GetSeasonNumber()
				if lf.GetType() == LocalFileTypeSpecial {
					seasonNum = 0
				}
			}

			var libEp *models.LibraryEpisode
			if libraryEpisodes != nil {
				key := fmt.Sprintf("%d-%d", seasonNum, lf.GetEpisodeNumber())
				if ep, ok := libraryEpisodes[key]; ok {
					libEp = ep
				}
			}

			return NewSimpleEpisode(&NewSimpleEpisodeOptions{
				LocalFile:       lf,
				Media:           e.Media,
				IsDownloaded:    true,
				MetadataWrapper: amw,
				LibraryEpisode:  libEp,
				IntelligenceSvc: e.IntelligenceSvc,
			})
		})
	}
	episodes := p.Wait()
	// Sort by progress number
	sort.Slice(episodes, func(i, j int) bool {
		return episodes[i].EpisodeNumber < episodes[j].EpisodeNumber
	})
	e.Episodes = episodes

	nextEp, found := e.FindNextEpisode()
	if found {
		e.NextEpisode = nextEp
	}

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func NewAnimeMetadataFromEntry(media *models.LibraryMedia, episodes []*Episode) *metadata.AnimeMetadata {
	animeMetadata := &metadata.AnimeMetadata{
		Titles:       make(map[string]string),
		Episodes:     make(map[string]*metadata.EpisodeMetadata),
		EpisodeCount: 0,
		Mappings: &metadata.AnimeMappings{
			ThemoviedbId: strconv.Itoa(int(media.ID)),
		},
	}
	animeMetadata.Titles["en"] = media.TitleEnglish
	animeMetadata.Titles["x-jat"] = media.TitleRomaji

	// Hydrate episodes
	for _, episode := range episodes {
		animeMetadata.Episodes[episode.FileMetadata.AniDBEpisode] = &metadata.EpisodeMetadata{
			AnidbId:               0,
			TvdbId:                0,
			Title:                 episode.DisplayTitle,
			Image:                 episode.EpisodeMetadata.Image,
			AirDate:               "",
			Length:                0,
			Summary:               "",
			Overview:              "",
			EpisodeNumber:         episode.EpisodeNumber,
			Episode:               strconv.Itoa(episode.EpisodeNumber),
			SeasonNumber:          0,
			AbsoluteEpisodeNumber: episode.EpisodeNumber,
			AnidbEid:              0,
			HasImage:              true,
		}
		animeMetadata.EpisodeCount++
	}

	return animeMetadata
}

func NewAnimeMetadataFromEpisodeCount(media *models.LibraryMedia, episodes []int) *metadata.AnimeMetadata {
	animeMetadata := &metadata.AnimeMetadata{
		Titles:       make(map[string]string),
		Episodes:     make(map[string]*metadata.EpisodeMetadata),
		EpisodeCount: 0,
		Mappings: &metadata.AnimeMappings{
			ThemoviedbId: strconv.Itoa(int(media.ID)), // Generic media ID marker
		},
	}
	animeMetadata.Titles["en"] = media.TitleEnglish
	animeMetadata.Titles["x-jat"] = media.TitleRomaji

	// Hydrate episodes
	for _, episode := range episodes {
		animeMetadata.Episodes[strconv.Itoa(episode)] = &metadata.EpisodeMetadata{
			AnidbId:               0,
			TvdbId:                0,
			Title:                 media.TitleEnglish,
			Image:                 media.BannerImage,
			AirDate:               "",
			Length:                0,
			Summary:               "",
			Overview:              "",
			EpisodeNumber:         episode,
			Episode:               strconv.Itoa(episode),
			SeasonNumber:          0,
			AbsoluteEpisodeNumber: episode,
			AnidbEid:              0,
			HasImage:              true,
		}
		animeMetadata.EpisodeCount++
	}

	return animeMetadata
}
