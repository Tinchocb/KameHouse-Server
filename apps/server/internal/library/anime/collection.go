package anime

import (
	"cmp"
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/hook"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"path/filepath"
	"slices"
	"sort"

	"github.com/samber/lo"
	lop "github.com/samber/lo/parallel"
	"github.com/sourcegraph/conc/pool"
)

type (
	// LibraryCollection holds the main data for the library collection.
	// It consists of:
	//  - ContinueWatchingList: a list of Episode for the "continue watching" feature.
	//  - Lists: a list of LibraryCollectionList (one for each status).
	//  - UnmatchedLocalFiles: a list of unmatched local files (Media id == 0). "Resolve unmatched" feature.
	//  - UnmatchedGroups: a list of UnmatchedGroup instances. Like UnmatchedLocalFiles, but grouped by directory. "Resolve unmatched" feature.
	//  - IgnoredLocalFiles: a list of ignored local files. (DEVNOTE: Unused for now)
	//  - UnknownGroups: a list of UnknownGroup instances. Group of files whose media is not in the user's AniList "Resolve unknown media" feature.
	LibraryCollection struct {
		ContinueWatchingList []*Episode               `json:"continueWatchingList"`
		Lists                []*LibraryCollectionList `json:"lists"`
		UnmatchedLocalFiles  []*LocalFile             `json:"unmatchedLocalFiles"`
		UnmatchedGroups      []*UnmatchedGroup        `json:"unmatchedGroups"`
		IgnoredLocalFiles    []*LocalFile             `json:"ignoredLocalFiles"`
		UnknownGroups        []*UnknownGroup          `json:"unknownGroups"`
		Stats                *LibraryCollectionStats  `json:"stats"`
		Stream               *StreamCollection        `json:"stream,omitempty"` // Hydrated by the route handler
	}

	StreamCollection struct {
		ContinueWatchingList []*Episode             `json:"continueWatchingList"`
		Anime                []*models.LibraryMedia `json:"anime"`
		ListData             map[int]*EntryListData `json:"listData"`
	}

	LibraryCollectionListType string

	LibraryCollectionStats struct {
		TotalEntries  int    `json:"totalEntries"`
		TotalFiles    int    `json:"totalFiles"`
		TotalShows    int    `json:"totalShows"`
		TotalMovies   int    `json:"totalMovies"`
		TotalSpecials int    `json:"totalSpecials"`
		TotalSize     string `json:"totalSize"`
	}

	LibraryCollectionList struct {
		Type    string                    `json:"type"`
		Status  string                    `json:"status"`
		Entries []*LibraryCollectionEntry `json:"entries"`
	}

	// LibraryCollectionEntry holds the data for a single entry in a LibraryCollectionList.
	// It is a slimmed down version of Entry. It holds the media, media id, library data, and list data.
	LibraryCollectionEntry struct {
		Media                  *models.LibraryMedia    `json:"media"`
		MediaId                int                     `json:"mediaId"`
		AvailabilityType       string                  `json:"availabilityType"`            // FULL_LOCAL, HYBRID, ONLY_ONLINE
		EntryLibraryData       *EntryLibraryData       `json:"libraryData"`                 // Library data
		NakamaEntryLibraryData *NakamaEntryLibraryData `json:"nakamaLibraryData,omitempty"` // Library data from Nakama
		EntryListData          *EntryListData          `json:"listData"`                    // Local list data
	}

	// UnmatchedGroup holds the data for a group of unmatched local files.
	UnmatchedGroup struct {
		Dir         string                 `json:"dir"`
		LocalFiles  []*LocalFile           `json:"localFiles"`
		Suggestions []*models.LibraryMedia `json:"suggestions"`
	}
	// UnknownGroup holds the data for a group of local files whose media is not in the user's AniList.
	// The client will use this data to suggest media to the user, so they can add it to their AniList.
	UnknownGroup struct {
		MediaId    int          `json:"mediaId"`
		LocalFiles []*LocalFile `json:"localFiles"`
	}
)

type (
	// NewLibraryCollectionOptions is a struct that holds the data needed for creating a new LibraryCollection.
	NewLibraryCollectionOptions struct {
		Database            *db.Database
		LocalFiles          []*LocalFile
		PlatformRef         *util.Ref[platform.Platform]
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
	}
)

// NewLibraryCollection creates a new LibraryCollection.
func NewLibraryCollection(ctx context.Context, opts *NewLibraryCollectionOptions) (lc *LibraryCollection, err error) {
	defer util.HandlePanicInModuleWithError("entities/collection/NewLibraryCollection", &err)
	lc = new(LibraryCollection)

	reqEvent := &AnimeLibraryCollectionRequestedEvent{
		Database:          opts.Database,
		LocalFiles:        opts.LocalFiles,
		LibraryCollection: lc,
	}
	err = hook.GlobalHookManager.OnAnimeLibraryCollectionRequested().Trigger(reqEvent)
	if err != nil {
		return nil, err
	}
	opts.Database = reqEvent.Database     // Override the database
	opts.LocalFiles = reqEvent.LocalFiles // Override the local files
	lc = reqEvent.LibraryCollection       // Override the library collection

	if reqEvent.DefaultPrevented {
		event := &AnimeLibraryCollectionEvent{
			LibraryCollection: lc,
		}
		err = hook.GlobalHookManager.OnAnimeLibraryCollection().Trigger(event)
		if err != nil {
			return nil, err
		}

		return event.LibraryCollection, nil
	}

	// Create lists using local SQLite DB
	lc.hydrateCollectionLists(opts)

	lc.hydrateStats(opts.LocalFiles)

	// Add Continue Watching list
	lc.hydrateContinueWatchingList(
		ctx,
		opts.LocalFiles,
		opts.Database,
		opts.PlatformRef,
		opts.MetadataProviderRef,
	)

	lc.UnmatchedLocalFiles = lo.Filter(opts.LocalFiles, func(lf *LocalFile, index int) bool {
		return lf.MediaId == 0 && !lf.Ignored
	})

	lc.IgnoredLocalFiles = lo.Filter(opts.LocalFiles, func(lf *LocalFile, index int) bool {
		return lf.Ignored == true
	})

	slices.SortStableFunc(lc.IgnoredLocalFiles, func(i, j *LocalFile) int {
		return cmp.Compare(i.GetPath(), j.GetPath())
	})

	lc.hydrateUnmatchedGroups()

	// Event
	event := &AnimeLibraryCollectionEvent{
		LibraryCollection: lc,
	}
	_ = hook.GlobalHookManager.OnAnimeLibraryCollection().Trigger(event)
	lc = event.LibraryCollection

	return
}

//----------------------------------------------------------------------------------------------------------------------

func (lc *LibraryCollection) hydrateCollectionLists(
	opts *NewLibraryCollectionOptions,
) {
	localFiles := opts.LocalFiles
	dbInfo := opts.Database

	// Group local files by media id
	groupedLfs := GroupLocalFilesByMediaID(localFiles)
	// Get slice of media ids from local files
	mIds := GetMediaIdsFromLocalFiles(localFiles)

	// Build a mapping from MediaId → LibraryMediaId using local files.
	// This is needed because for TMDB media (negative MediaIds), the DB primary key
	// (LibraryMediaId) differs from the external MediaId, and uint(negativeId) wraps around.
	mediaIdToLibraryMediaId := make(map[int]uint)
	for _, lf := range localFiles {
		if lf.MediaId != 0 && lf.LibraryMediaId != 0 {
			if _, exists := mediaIdToLibraryMediaId[lf.MediaId]; !exists {
				mediaIdToLibraryMediaId[lf.MediaId] = lf.LibraryMediaId
			}
		}
	}

	mediaMap := make(map[int]*models.LibraryMedia)
	listDataMap := make(map[int]*models.MediaEntryListData)

	for _, id := range mIds {
		if id == 0 {
			continue
		}

		var media *models.LibraryMedia
		var listData *models.MediaEntryListData
		var lookupId uint

		// First, try looking up by MediaId directly (works for AniList positive IDs
		// where the DB primary key == AniList ID)
		if id > 0 {
			m, err := db.GetLibraryMediaByID(dbInfo, uint(id))
			if err == nil && m != nil {
				media = m
				lookupId = uint(id)
			}
		}

		// If not found by MediaId, try using the LibraryMediaId from local files
		// (needed for TMDB media with negative MediaIds)
		if media == nil {
			if libMediaId, ok := mediaIdToLibraryMediaId[id]; ok && libMediaId > 0 {
				m, err := db.GetLibraryMediaByID(dbInfo, libMediaId)
				if err == nil && m != nil {
					media = m
					lookupId = libMediaId
				}
			}
		}

		if media != nil {
			mediaMap[id] = media
		}

		// Look up list data using the same ID that successfully found the media
		if lookupId > 0 {
			ld, err := db.GetMediaEntryListData(dbInfo, lookupId)
			if err == nil && ld != nil {
				listData = ld
			}
		}

		if listData != nil {
			listDataMap[id] = listData
		} else {
			// fallback
			listDataMap[id] = &models.MediaEntryListData{
				Status: "PLANNING",
			}
		}
	}

	statusGroups := make(map[string][]*LibraryCollectionEntry)

	for _, id := range mIds {
		if id == 0 {
			continue
		}
		media, ok := mediaMap[id]
		if !ok {
			continue
		}

		entryLfs := groupedLfs[id]
		listData := listDataMap[id]
		status := listData.Status
		if status == "" || status == "REPEATING" {
			status = "CURRENT" // map REPEATING or empty to CURRENT
		}

		libraryData, _ := NewEntryLibraryData(&NewEntryLibraryDataOptions{
			EntryLocalFiles: entryLfs,
			MediaId:         id,
			CurrentProgress: listData.Progress,
		})

		availabilityType := "ONLY_ONLINE"
		if libraryData != nil && libraryData.MainFileCount > 0 {
			if media.TotalEpisodes > 0 && libraryData.MainFileCount >= media.TotalEpisodes {
				availabilityType = "FULL_LOCAL"
			} else {
				availabilityType = "HYBRID"
			}
		}

		lce := &LibraryCollectionEntry{
			MediaId:          id,
			Media:            media,
			AvailabilityType: availabilityType,
			EntryLibraryData: libraryData,
			EntryListData: &EntryListData{
				Progress:    listData.Progress,
				Score:       listData.Score,
				Status:      status,
				Repeat:      listData.Repeat,
				StartedAt:   listData.StartedAt,
				CompletedAt: listData.CompletedAt,
			},
		}

		statusGroups[status] = append(statusGroups[status], lce)
	}

	lists := make([]*LibraryCollectionList, 0)
	for status, entries := range statusGroups {
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].Media.TitleRomaji < entries[j].Media.TitleRomaji
		})

		lists = append(lists, &LibraryCollectionList{
			Type:    status,
			Status:  status,
			Entries: entries,
		})
	}

	lc.Lists = lists

	if lc.Lists == nil {
		lc.Lists = make([]*LibraryCollectionList, 0)
	}

	// +---------------------+
	// |  Unknown media ids  |
	// +---------------------+

	unknownIds := make([]int, 0)
	for _, id := range mIds {
		if id != 0 && mediaMap[id] == nil {
			unknownIds = append(unknownIds, id)
		}
	}

	lc.UnknownGroups = make([]*UnknownGroup, 0)
	for _, id := range unknownIds {
		lc.UnknownGroups = append(lc.UnknownGroups, &UnknownGroup{
			MediaId:    id,
			LocalFiles: groupedLfs[id],
		})
	}
}

//----------------------------------------------------------------------------------------------------------------------

func (lc *LibraryCollection) hydrateStats(lfs []*LocalFile) {
	stats := &LibraryCollectionStats{
		TotalFiles:    len(lfs),
		TotalEntries:  0,
		TotalShows:    0,
		TotalMovies:   0,
		TotalSpecials: 0,
		TotalSize:     "", // Will be set by the route handler
	}

	for _, list := range lc.Lists {
		for _, entry := range list.Entries {
			stats.TotalEntries++
			if entry.Media.Format != "" {
				if entry.Media.Format == "MOVIE" {
					stats.TotalMovies++
				} else if entry.Media.Format == "SPECIAL" || entry.Media.Format == "OVA" {
					stats.TotalSpecials++
				} else {
					stats.TotalShows++
				}
			}
		}
	}

	lc.Stats = stats
}

//----------------------------------------------------------------------------------------------------------------------

// hydrateContinueWatchingList creates a list of Episode for the "continue watching" feature.
// This should be called after the LibraryCollectionList's have been created.
func (lc *LibraryCollection) hydrateContinueWatchingList(
	ctx context.Context,
	localFiles []*LocalFile,
	database *db.Database,
	platformRef *util.Ref[platform.Platform],
	metadataProviderRef *util.Ref[metadata_provider.Provider],
) {

	// Get currently watching list
	current, found := lo.Find(lc.Lists, func(item *LibraryCollectionList) bool {
		return item.Status == "CURRENT"
	})

	// If no currently watching list is found, return an empty slice
	if !found {
		println("CURRENT list NOT FOUND!")
		lc.ContinueWatchingList = make([]*Episode, 0) // Set empty slice
		return
	}
	println("CURRENT list FOUND! Number of entries:", len(current.Entries))
	// Get media ids from current list
	mIds := make([]int, len(current.Entries))
	for i, entry := range current.Entries {
		mIds[i] = entry.MediaId
	}

	// Create a new Entry for each media id
	mEntryPool := pool.NewWithResults[*Entry]()
	for _, mId := range mIds {
		mEntryPool.Go(func() *Entry {
			me, _ := NewEntry(ctx, &NewEntryOptions{
				MediaId:             mId,
				LocalFiles:          localFiles,
				Database:            database,
				PlatformRef:         platformRef,
				MetadataProviderRef: metadataProviderRef,
			})
			return me
		})
	}
	mEntries := mEntryPool.Wait()
	mEntries = lo.Filter(mEntries, func(item *Entry, index int) bool {
		return item != nil
	}) // Filter out nil entries

	// If there are no entries, return an empty slice
	if len(mEntries) == 0 {
		lc.ContinueWatchingList = make([]*Episode, 0) // Return empty slice
		return
	}

	// Sort by progress
	sort.Slice(mEntries, func(i, j int) bool {
		return mEntries[i].EntryListData.Progress > mEntries[j].EntryListData.Progress
	})

	// Remove entries the user has watched all episodes of
	mEntries = lop.Map(mEntries, func(mEntry *Entry, index int) *Entry {
		if !mEntry.HasWatchedAll() {
			return mEntry
		}
		return nil
	})
	mEntries = lo.Filter(mEntries, func(item *Entry, index int) bool {
		return item != nil
	})

	// Get the next episode for each media entry
	mEpisodes := lop.Map(mEntries, func(mEntry *Entry, index int) *Episode {
		ep, ok := mEntry.FindNextEpisode()
		if ok {
			return ep
		}
		return nil
	})
	mEpisodes = lo.Filter(mEpisodes, func(item *Episode, index int) bool {
		return item != nil
	})

	lc.ContinueWatchingList = mEpisodes
}

//----------------------------------------------------------------------------------------------------------------------

// hydrateUnmatchedGroups is a method of the LibraryCollection struct.
// It is responsible for grouping unmatched local files by their directory and creating UnmatchedGroup instances for each group.
func (lc *LibraryCollection) hydrateUnmatchedGroups() {

	groups := make([]*UnmatchedGroup, 0)

	// Group by directory
	groupedLfs := lop.GroupBy(lc.UnmatchedLocalFiles, func(lf *LocalFile) string {
		return filepath.Dir(lf.GetPath())
	})

	for key, value := range groupedLfs {
		groups = append(groups, &UnmatchedGroup{
			Dir:         key,
			LocalFiles:  value,
			Suggestions: make([]*models.LibraryMedia, 0),
		})
	}

	slices.SortStableFunc(groups, func(i, j *UnmatchedGroup) int {
		return cmp.Compare(i.Dir, j.Dir)
	})

	// Assign the created groups
	lc.UnmatchedGroups = groups
}
