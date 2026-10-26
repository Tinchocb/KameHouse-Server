package anime

import (
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/platforms/platform"
	"path/filepath"
	"slices"
	"sort"

	"github.com/samber/lo"
	lop "github.com/samber/lo/parallel"
	"github.com/sourcegraph/conc/pool"
)

//----------------------------------------------------------------------------------------------------------------------

func (lc *LibraryCollection) hydrateCollectionLists(
	opts *NewLibraryCollectionOptions,
) {
	localFiles := opts.LocalFiles
	dbInfo := opts.Database

	// DEBUG: Log local files count
	if len(localFiles) == 0 {
		opts.Database.Logger.Warn().Msg("anime/collection: No local files found in database!")
	}

	// Group local files by media id
	groupedLfs := GroupLocalFilesByMediaID(localFiles)
	// Get slice of media ids from local files
	mIds := GetMediaIdsFromLocalFiles(localFiles)

	// DEBUG: Log media IDs count
	if len(mIds) == 0 {
		opts.Database.Logger.Warn().Msg("anime/collection: No media IDs found from local files!")
	}

	// Build a mapping from MediaID â†’ LibraryMediaId using local files.
	// This is needed because for TMDB media, the DB primary key
	// (LibraryMediaId) might differ from the external MediaID.
	mediaIdToLibraryMediaId := make(map[int]uint)
	for _, lf := range localFiles {
		if lf.MediaID != 0 && lf.LibraryMediaId != 0 {
			if _, exists := mediaIdToLibraryMediaId[lf.MediaID]; !exists {
				mediaIdToLibraryMediaId[lf.MediaID] = lf.LibraryMediaId
			}
		}
	}

	mediaMap := make(map[int]*models.LibraryMedia)
	listDataMap := make(map[int]*models.MediaEntryListData)

	// Batch preload all LibraryMedia and MediaEntryListData to eliminate N+1 queries
	var allLibraryMedia []*models.LibraryMedia
	if err := dbInfo.Gorm().Find(&allLibraryMedia).Error; err != nil {
		opts.Database.Logger.Error().Err(err).Msg("anime/collection: Failed to preload LibraryMedia")
	}

	byPK := make(map[uint]*models.LibraryMedia, len(allLibraryMedia))
	byTmdbType := make(map[string]*models.LibraryMedia, len(allLibraryMedia))
	byTmdb := make(map[int]*models.LibraryMedia, len(allLibraryMedia))
	for _, m := range allLibraryMedia {
		byPK[m.ID] = m
		byTmdbType[fmt.Sprintf("%d-%s", m.TmdbID, m.Type)] = m
		if _, exists := byTmdb[m.TmdbID]; !exists {
			byTmdb[m.TmdbID] = m
		}
	}

	var allListData []*models.MediaEntryListData
	if err := dbInfo.Gorm().Find(&allListData).Error; err != nil {
		opts.Database.Logger.Error().Err(err).Msg("anime/collection: Failed to preload MediaEntryListData")
	}
	listDataByMediaID := make(map[uint]*models.MediaEntryListData, len(allListData))
	for _, ld := range allListData {
		listDataByMediaID[ld.LibraryMediaID] = ld
	}

	for _, id := range mIds {
		if id == 0 {
			continue
		}

		var media *models.LibraryMedia
		var listData *models.MediaEntryListData
		var lookupId uint

		// 1. First, try looking up by MediaID directly.
		if id >= 1_000_000 {
			tmdbID := id - 1_000_000
			if m, ok := byTmdbType[fmt.Sprintf("%d-MOVIE", tmdbID)]; ok {
				media = m
				lookupId = m.ID
			} else if m, ok := byTmdbType[fmt.Sprintf("%d-SHOW", tmdbID)]; ok {
				media = m
				lookupId = m.ID
			}
		} else if id > 0 {
			if m, ok := byPK[uint(id)]; ok {
				media = m
				lookupId = uint(id)
			}
		}

		// 2. If not found by direct lookup, try using the LibraryMediaId association from local files
		if media == nil {
			if libMediaId, ok := mediaIdToLibraryMediaId[id]; ok && libMediaId > 0 {
				if m, ok := byPK[libMediaId]; ok {
					media = m
					lookupId = libMediaId
				}
			}
		}

		// 3. Fallback: If it's a positive ID but not >= 1M, look up in tmdb map
		if media == nil && id > 0 && id < 1_000_000 {
			if m, ok := byTmdbType[fmt.Sprintf("%d-SHOW", id)]; ok {
				media = m
				lookupId = m.ID
			} else if m, ok := byTmdbType[fmt.Sprintf("%d-MOVIE", id)]; ok {
				media = m
				lookupId = m.ID
			} else if m, ok := byTmdb[id]; ok {
				media = m
				lookupId = m.ID
			}
		}

		if media != nil {
			mediaMap[id] = media
		} else {
			opts.Database.Logger.Debug().Int("mediaID", id).Msg("anime/collection: Failed to hydrate media entry")
		}

		// Look up list data using the lookupId
		if lookupId > 0 {
			if ld, ok := listDataByMediaID[lookupId]; ok {
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

	// DEBUG: Log found media count
	if len(mediaMap) == 0 {
		opts.Database.Logger.Warn().Int("mIdsCount", len(mIds)).Msg("anime/collection: No media found in database for media IDs!")
	} else {
		opts.Database.Logger.Debug().Int("mediaCount", len(mediaMap)).Int("mIdsCount", len(mIds)).Msg("anime/collection: Found media in database")
	}

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
			MediaID:         id,
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
			MediaID:          id,
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
			DominantVibe: media.DominantVibe,
		}

		if media.Tags != nil {
			_ = json.Unmarshal(media.Tags, &lce.Tags)
		}

		lce.DeriveVibes()

		statusGroups[status] = append(statusGroups[status], lce)
	}

	lists := make([]*LibraryCollectionList, 0)
	for status, entries := range statusGroups {
		entries = lo.Filter(entries, func(e *LibraryCollectionEntry, _ int) bool {
			return e != nil && e.Media != nil
		})
		sort.Slice(entries, func(i, j int) bool {
			if entries[i] == nil || entries[i].Media == nil {
				return false
			}
			if entries[j] == nil || entries[j].Media == nil {
				return true
			}
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
			MediaID:    id,
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
				switch entry.Media.Format {
				case "MOVIE":
					stats.TotalMovies++
				case "SPECIAL", "OVA":
					stats.TotalSpecials++
				default:
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
	platformRef platform.Platform,
	metadataProviderRef metadata_provider.Provider,
) {

	// Get currently watching list
	current, found := lo.Find(lc.Lists, func(item *LibraryCollectionList) bool {
		return item.Status == "CURRENT"
	})

	// If no currently watching list is found, return an empty slice
	if !found {
		lc.ContinueWatchingList = make([]*Episode, 0) // Set empty slice
		return
	}

	// Get media ids from current list
	mIds := make([]int, len(current.Entries))
	for i, entry := range current.Entries {
		mIds[i] = entry.MediaID
	}

	// Batch preload LibraryEpisodes across all media IDs in 1 query to avoid N+1 lookups.
	// Map external MediaID (TMDB ID or +1M movie offset) to internal LibraryMedia.ID (PK).
	mediaIDToLibraryMediaID := make(map[int]uint)
	for _, lf := range localFiles {
		if lf.LibraryMediaId > 0 && lf.MediaID > 0 {
			mediaIDToLibraryMediaID[lf.MediaID] = lf.LibraryMediaId
		}
	}

	var unmappedMIDs []int
	for _, mID := range mIds {
		if _, ok := mediaIDToLibraryMediaID[mID]; !ok {
			unmappedMIDs = append(unmappedMIDs, mID)
		}
	}

	if len(unmappedMIDs) > 0 && database != nil {
		var tmdbIDs []int
		for _, id := range unmappedMIDs {
			if id >= 1_000_000 {
				tmdbIDs = append(tmdbIDs, id-1_000_000)
			} else {
				tmdbIDs = append(tmdbIDs, id)
			}
		}
		var foundMedias []*models.LibraryMedia
		if err := database.Gorm().Where("tmdb_id IN (?) OR id IN (?)", tmdbIDs, unmappedMIDs).Find(&foundMedias).Error; err == nil {
			for _, m := range foundMedias {
				mediaIDToLibraryMediaID[int(m.ID)] = m.ID
				mediaIDToLibraryMediaID[m.TmdbID] = m.ID
				if m.Type == "MOVIE" || m.TmdbID+1_000_000 > 1_000_000 {
					mediaIDToLibraryMediaID[m.TmdbID+1_000_000] = m.ID
				}
			}
		}
	}

	libIDSet := make(map[uint]struct{})
	for _, mID := range mIds {
		if libID, ok := mediaIDToLibraryMediaID[mID]; ok && libID > 0 {
			libIDSet[libID] = struct{}{}
		}
	}
	var libraryMediaIDs []uint
	for libID := range libIDSet {
		libraryMediaIDs = append(libraryMediaIDs, libID)
	}

	var batchEpisodes []*models.LibraryEpisode
	episodesByMedia := make(map[uint]map[string]*models.LibraryEpisode)
	if len(libraryMediaIDs) > 0 && database != nil {
		if err := database.Gorm().Where("library_media_id IN (?)", libraryMediaIDs).Find(&batchEpisodes).Error; err == nil {
			for _, ep := range batchEpisodes {
				if _, ok := episodesByMedia[ep.LibraryMediaID]; !ok {
					episodesByMedia[ep.LibraryMediaID] = make(map[string]*models.LibraryEpisode)
				}
				key := fmt.Sprintf("%d-%d", ep.SeasonNumber, ep.EpisodeNumber)
				episodesByMedia[ep.LibraryMediaID][key] = ep
				if ep.AbsoluteNumber > 0 {
					absKey := fmt.Sprintf("abs-%d", ep.AbsoluteNumber)
					episodesByMedia[ep.LibraryMediaID][absKey] = ep
				}
			}
		}
	}

	// Create a new Entry for each media id
	mEntryPool := pool.NewWithResults[*Entry]().WithMaxGoroutines(8)
	for _, mID := range mIds {
		mID := mID
		mEntryPool.Go(func() *Entry {
			var eps map[string]*models.LibraryEpisode
			if libID, ok := mediaIDToLibraryMediaID[mID]; ok {
				if m, found := episodesByMedia[libID]; found {
					eps = m
				} else {
					// Preloaded but 0 episodes exist in DB for this media;
					// passing non-nil empty map prevents NewEntry from executing redundant individual query
					eps = make(map[string]*models.LibraryEpisode)
				}
			}
			me, _ := NewEntry(ctx, &NewEntryOptions{
				MediaID:             mID,
				LocalFiles:          localFiles,
				Database:            database,
				PlatformRef:         platformRef,
				MetadataProviderRef: metadataProviderRef,
				LibraryEpisodes:     eps,
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
