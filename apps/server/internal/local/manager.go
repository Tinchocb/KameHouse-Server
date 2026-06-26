package local

import (
	"context"
	"fmt"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
	"github.com/samber/mo"
)

var (
	ErrAlreadyTracked = fmt.Errorf("local manager: Media already tracked")
)

const (
	AnimeType = "anime"
)

type Manager interface {
	// SetAnimeCollection updates the online anime collection in the manager.
	SetAnimeCollection(ac *platform.UnifiedCollection)
	// GetLocalAnimeCollection returns the local anime collection stored in the local database.
	GetLocalAnimeCollection() mo.Option[*platform.UnifiedCollection]
	// UpdateLocalAnimeCollection updates the local anime collection using the online data.
	UpdateLocalAnimeCollection(ac *platform.UnifiedCollection)
	// GetOfflineMetadataProvider returns the offline metadata provider.
	GetOfflineMetadataProvider() metadata_provider.Provider
	AutoTrackCurrentMedia() (bool, error)
	// TrackAnime adds an anime to track for offline use.
	// It checks that the anime is currently in the user's anime collection.
	TrackAnime(mID int) error
	// UntrackAnime removes the anime from tracking.
	UntrackAnime(mID int) error
	// IsMediaTracked checks if the media is tracked in the local database.
	IsMediaTracked(aId int, kind string) bool
	// GetTrackedMediaItems returns all tracked media items.
	GetTrackedMediaItems() []*TrackedMediaItem
	// ScanLocal scans all currently tracked media.
	// Compares the local database with the user's anime collection and updates the local database accordingly.
	ScanLocal() error
	// ScanPlatform syncs the user's Platform data with data stored in the local database.
	ScanPlatform() error
	// SetRefreshPlatformCollectionsFunc sets the function to call to refresh the online Platform collections.
	SetRefreshPlatformCollectionsFunc(func())
	// HasLocalChanges checks if there are any local changes that need to be uploaded or ignored.
	HasLocalChanges() bool
	// SetHasLocalChanges sets the flag to determine if there are local changes that need to be uploaded or ignored.
	SetHasLocalChanges(bool)
	// GetLocalStorageSize returns the size of the local storage in bytes.
	GetLocalStorageSize() int64
	// GetSimulatedAnimeCollection returns the simulated anime collection for unauthenticated users.
	GetSimulatedAnimeCollection() mo.Option[*platform.UnifiedCollection]
	// SaveSimulatedAnimeCollection sets the simulated anime collection for unauthenticated users.
	SaveSimulatedAnimeCollection(ac *platform.UnifiedCollection)
	// ScanSimulatedCollectionToPlatform scans the simulated anime collection to the user's Platform account.
	ScanSimulatedCollectionToPlatform() error
	// ScanPlatformToSimulatedCollection scans the user's Platform account to the simulated anime collection.
	ScanPlatformToSimulatedCollection() error

	SetOffline(bool)
}

type (
	ManagerImpl struct {
		db             *db.Database
		localDb        *Database
		localDir       string
		localAssetsDir string
		isOffline      bool

		logger                  *zerolog.Logger
		metadataProviderRef     metadata_provider.Provider
		wsEventManager          events.WSEventManagerInterface
		offlineMetadataProvider metadata_provider.Provider
		platformRef             platform.Platform

		// Anime collection stored in the local database, without modifications
		localAnimeCollection mo.Option[*platform.UnifiedCollection]

		// Anime collection from the user's account, changed by ManagerImpl.SetAnimeCollection
		animeCollection mo.Option[*platform.UnifiedCollection]

		// Local files, set by ManagerImpl.ScanLocal
		localFiles []*dto.LocalFile

		RefreshPlatformCollectionsFunc func()
	}
	TrackedMediaItem struct {
		MediaID    int                              `json:"mediaId"`
		Type       string                           `json:"type"`
		AnimeEntry *platform.UnifiedCollectionEntry `json:"animeEntry,omitempty"`
	}

	NewManagerOptions struct {
		LocalDir            string
		AssetDir            string
		Logger              *zerolog.Logger
		MetadataProviderRef metadata_provider.Provider
		Database            *db.Database
		WSEventManager      events.WSEventManagerInterface
		PlatformRef         platform.Platform
		IsOffline           bool
	}
)

func NewManager(opts *NewManagerOptions) (Manager, error) {

	_ = os.MkdirAll(opts.LocalDir, os.ModePerm)

	localDb, err := newLocalSyncDatabase(opts.LocalDir, "local", opts.Logger)
	if err != nil {
		return nil, err
	}

	ret := &ManagerImpl{
		db:                            opts.Database,
		localDb:                       localDb,
		localDir:                      opts.LocalDir,
		localAssetsDir:                opts.AssetDir,
		logger:                        opts.Logger,
		animeCollection:               mo.None[*platform.UnifiedCollection](),
		localAnimeCollection:          mo.None[*platform.UnifiedCollection](),
		metadataProviderRef:           opts.MetadataProviderRef,
		localFiles:                    make([]*dto.LocalFile, 0),
		wsEventManager:                opts.WSEventManager,
		isOffline:                     opts.IsOffline,
		platformRef:                   opts.PlatformRef,
		RefreshPlatformCollectionsFunc: func() {},
	}

	ret.offlineMetadataProvider = NewOfflineMetadataProvider(ret)

	// Load the local collections
	ret.loadLocalAnimeCollection()

	_ = ret.localDb.GetSettings()

	return ret, nil
}

func (m *ManagerImpl) SetRefreshPlatformCollectionsFunc(f func()) {
	m.RefreshPlatformCollectionsFunc = f
}



func (m *ManagerImpl) GetOfflineMetadataProvider() metadata_provider.Provider {
	return m.offlineMetadataProvider
}

func (m *ManagerImpl) SetOffline(enabled bool) {
	m.isOffline = enabled
}

func (m *ManagerImpl) HasLocalChanges() bool {
	s := m.localDb.GetSettings()
	return s.Updated
}

func (m *ManagerImpl) SetHasLocalChanges(b bool) {
	s := m.localDb.GetSettings()
	if s.Updated == b {
		return
	}
	s.Updated = b
	_ = m.localDb.SaveSettings(s)
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *ManagerImpl) loadLocalAnimeCollection() {
	collection, ok := m.localDb.GetLocalAnimeCollection()
	if !ok {
		m.localAnimeCollection = mo.None[*platform.UnifiedCollection]()
		return
	}
	m.localAnimeCollection = mo.Some(collection)
}

func (m *ManagerImpl) SetAnimeCollection(ac *platform.UnifiedCollection) {
	if ac == nil {
		m.animeCollection = mo.None[*platform.UnifiedCollection]()
	} else {
		m.animeCollection = mo.Some(ac)
	}
}

func (m *ManagerImpl) GetLocalAnimeCollection() mo.Option[*platform.UnifiedCollection] {
	return m.localAnimeCollection
}

func (m *ManagerImpl) UpdateLocalAnimeCollection(ac *platform.UnifiedCollection) {
	_ = m.localDb.SaveAnimeCollection(ac)
	m.loadLocalAnimeCollection()
}

func (m *ManagerImpl) AutoTrackCurrentMedia() (added bool, err error) {

	m.logger.Trace().Msgf("local manager: Saving all current media for offline use")

	trackedMedia := m.GetTrackedMediaItems()
	trackedMediaMap := make(map[int]struct{})
	for _, item := range trackedMedia {
		trackedMediaMap[item.MediaID] = struct{}{}
	}

	groupedLocalFiles := lo.GroupBy(m.localFiles, func(f *dto.LocalFile) int {
		return f.MediaID
	})

	animeCollection, ok := m.animeCollection.Get()
	if ok {
		for _, list := range animeCollection.Lists {
			for _, entry := range list.Entries {
				if entry.Status != platform.MediaListStatusCurrent {
					continue
				}
				if _, found := trackedMediaMap[entry.Media.ID]; found {
					continue
				}

				lfs, ok := groupedLocalFiles[entry.Media.ID]
				if !ok || len(lfs) == 0 {
					continue
				}

				err := m.TrackAnime(entry.Media.ID)
				if err != nil {
					continue
				}
				added = true
				m.logger.Trace().Msgf("local manager: Adding anime %d to local database", entry.Media.ID)
			}
		}
	}

	return
}

// TrackAnime adds an anime to track.
// It checks that the anime is currently in the user's anime collection.
// The anime should have local files, or else ManagerImpl.Synchronize will remove it from tracking.
func (m *ManagerImpl) TrackAnime(mID int) error {

	m.logger.Trace().Msgf("local manager: Adding anime %d to local database", mID)

	s := &TrackedMedia{
		MediaID: mID,
		Type:    AnimeType,
	}

	// Check if the anime is in the user's anime collection
	if m.animeCollection.IsAbsent() {
		m.logger.Error().Msg("local manager: Anime collection not set")
		return fmt.Errorf("anime collection not set")
	}

	if _, found := m.animeCollection.MustGet().GetListEntryFromMediaId(mID); !found {
		m.logger.Error().Msgf("local manager: Anime %d not found in user's anime collection", mID)
		return fmt.Errorf("anime is not in collection")
	}

	if _, found := m.localDb.GetTrackedMedia(mID, AnimeType); found {
		return ErrAlreadyTracked
	}

	err := m.localDb.gormdb.Create(s).Error
	if err != nil {
		m.logger.Error().Msgf("local manager: Failed to add anime %d to local database: %v", mID, err)
		return fmt.Errorf("failed to add anime %d to local database: %w", mID, err)
	}

	return nil
}

func (m *ManagerImpl) UntrackAnime(mID int) error {

	m.logger.Trace().Msgf("local manager: Removing anime %d from local database", mID)

	if _, found := m.localDb.GetTrackedMedia(mID, AnimeType); !found {
		m.logger.Error().Msgf("local manager: Anime %d not in local database", mID)
		return fmt.Errorf("anime is not in local database")
	}

	err := m.removeAnime(mID)
	if err != nil {
		return err
	}

	m.loadLocalAnimeCollection()

	return nil
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

func (m *ManagerImpl) IsMediaTracked(aId int, kind string) bool {
	_, found := m.localDb.GetTrackedMedia(aId, kind)
	return found
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

func (m *ManagerImpl) GetTrackedMediaItems() (ret []*TrackedMediaItem) {
	trackedMedia, ok := m.localDb.GetAllTrackedMedia()
	if !ok {
		return
	}

	if m.animeCollection.IsAbsent() {
		return
	}

	for _, item := range trackedMedia {
		if item.Type == AnimeType {
			if localAnimeCollection, found := m.localAnimeCollection.Get(); found {
				if e, found := localAnimeCollection.GetListEntryFromMediaId(item.MediaID); found {
					ret = append(ret, &TrackedMediaItem{
						MediaID:    item.MediaID,
						Type:       item.Type,
						AnimeEntry: e,
					})
					continue
				}
				if e, found := m.animeCollection.MustGet().GetListEntryFromMediaId(item.MediaID); found {
					ret = append(ret, &TrackedMediaItem{
						MediaID:    item.MediaID,
						Type:       item.Type,
						AnimeEntry: e,
					})
					continue
				}
			}
		}
	}

	return
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

// ScanLocal should be called after updates to the user's anime collection.
//
//   - After adding/removing an anime to track
//   - After the user's anime collection has been updated (e.g. after a user's anime list has been updated)
//
// It will scan media list entries from the user's collection only if the media is tracked.
//   - The scanner will then update the anime with the local database if needed
//
// It will remove any anime from the local database that are not in the user's collection anymore.
// It will then update the ManagerImpl.localAnimeCollection
func (m *ManagerImpl) ScanLocal() error {

	localStorageSizeCache.Store(0)

	m.loadLocalAnimeCollection()

	settings := m.localDb.GetSettings()
	if settings.Updated {
		return fmt.Errorf("cannot scan, upload or ignore local changes before scanning")
	}

	lfs, _, err := db.GetLocalFiles(m.db)
	if err != nil {
		return fmt.Errorf("local manager: Couldn't start scanning, failed to get local files: %w", err)
	}

	// Check if the anime collection is set
	if m.animeCollection.IsAbsent() {
		return fmt.Errorf("local manager: Couldn't start scanning, anime collection not set")
	}

	return m.scan(lfs)
}

func (m *ManagerImpl) scan(lfs []*dto.LocalFile) error {

	m.logger.Trace().Msg("local manager: Scanning local database with user's anime collections")

	m.localFiles = lfs

	// Check if the anime collection is set
	if m.animeCollection.IsAbsent() {
		return fmt.Errorf("local manager: Anime collection not set")
	}

	trackedAnimeMap := m.loadTrackedMedia()

	// Remove anime from the local database that are not in the user's anime collections
	for _, item := range trackedAnimeMap {
		// If the anime is not in the user's anime collection, remove it from the local database
		if _, found := m.animeCollection.MustGet().GetListEntryFromMediaId(item.MediaID); !found {
			err := m.removeAnime(item.MediaID)
			if err != nil {
				return fmt.Errorf("local manager: Failed to remove anime %d from local database: %w", item.MediaID, err)
			}
		}
	}
	// Get snapshots for all tracked anime
	animeSnapshots, _ := m.localDb.GetAnimeSnapshots()

	// Create a map of the snapshots
	animeSnapshotMap := make(map[int]*AnimeSnapshot)
	for _, snapshot := range animeSnapshots {
		animeSnapshotMap[snapshot.MediaID] = snapshot
	}

	diff := &Diff{Logger: m.logger}
	animeDiffs := diff.GetAnimeDiffs(GetAnimeDiffOptions{
		Collection:      m.animeCollection.MustGet(),
		LocalCollection: m.localAnimeCollection,
		LocalFiles:      m.localFiles,
		TrackedAnime:    trackedAnimeMap,
		Snapshots:       animeSnapshotMap,
	})

	for _, d := range animeDiffs {
		m.processAnimeDiff(d)
	}

	m.loadLocalAnimeCollection()

	return nil
}

func (m *ManagerImpl) processAnimeDiff(diff *AnimeDiffResult) {
	entry := diff.AnimeEntry
	lfs := lo.Filter(m.localFiles, func(lf *dto.LocalFile, _ int) bool {
		return lf.MediaID == entry.Media.ID
	})

	var animeMetadata *metadata.AnimeMetadata
	var metadataWrapper metadata_provider.AnimeMetadataWrapper
	if diff.DiffType == DiffTypeMissing || diff.DiffType == DiffTypeMetadata {
		// Get the anime metadata
		var err error
		animeMetadata, err = m.metadataProviderRef.GetAnimeMetadata(entry.Media.ID)
		if err != nil {
			// If the anime metadata doesn't exist, create a fake one
			simpleEntry, err := anime.NewSimpleEntry(context.Background(), &anime.NewSimpleAnimeEntryOptions{
				MediaID:             entry.Media.ID,
				LocalFiles:          lfs,
				Database:            nil,
				PlatformRef:         m.platformRef,
				MetadataProviderRef: m.metadataProviderRef,
			})
			if err != nil {
				m.logger.Error().Err(err).Msgf("local manager: Failed to get metadata for anime %d", entry.Media.ID)
				return
			}

			animeMetadata = anime.NewAnimeMetadataFromEntry(models.ToLibraryMedia(entry.Media), simpleEntry.Episodes)
		}
		metadataWrapper = m.metadataProviderRef.GetAnimeMetadataWrapper(entry.Media, animeMetadata)
	}

	//
	// The snapshot is missing
	//
	if diff.DiffType == DiffTypeMissing && animeMetadata != nil {
		bannerImage, coverImage, episodeImagePaths, ok := DownloadAnimeImages(m.logger, m.localAssetsDir, entry, animeMetadata, metadataWrapper, lfs)
		if !ok {
			return
		}

		// Create a new snapshot
		snapshot := &AnimeSnapshot{
			MediaID:           entry.Media.ID,
			AnimeMetadata:     LocalAnimeMetadata(*animeMetadata),
			BannerImagePath:   bannerImage,
			CoverImagePath:    coverImage,
			EpisodeImagePaths: episodeImagePaths,
			ReferenceKey:      GetAnimeReferenceKey(entry.Media, m.localFiles),
		}

		// Save the snapshot
		err := m.localDb.SaveAnimeSnapshot(snapshot)
		if err != nil {
			m.logger.Error().Err(err).Msgf("local manager: Failed to save anime snapshot for anime %d", entry.Media.ID)
		}
		return
	}

	//
	// The snapshot metadata is outdated (local files have changed)
	// Update the anime metadata & download the new episode images if needed
	//
	if diff.DiffType == DiffTypeMetadata && diff.AnimeSnapshot != nil && animeMetadata != nil {

		snapshot := *diff.AnimeSnapshot
		snapshot.AnimeMetadata = LocalAnimeMetadata(*animeMetadata)
		snapshot.ReferenceKey = GetAnimeReferenceKey(entry.Media, m.localFiles)

		lfMap := make(map[string]*dto.LocalFile)
		for _, lf := range lfs {
			lfMap[lf.Metadata.AniDBEpisode] = lf
		}

		// Get the current episode image URLs
		currentEpisodeImageUrls := make(map[string]string)
		for episodeNum, episode := range animeMetadata.Episodes {
			if episode.Image == "" {
				continue
			}
			currentEpisodeImageUrls[episodeNum] = episode.Image
		}

		// Get the episode image URLs that we need to download (i.e. the ones that are not in the snapshot)
		episodeImageUrlsToDownload := make(map[string]string)
		// For each current episode image URL, check if the key (episode number) is in the snapshot
		for episodeNum, episodeImageUrl := range currentEpisodeImageUrls {
			if _, found := snapshot.EpisodeImagePaths[episodeNum]; !found {
				// Check if the episode is in the local files
				if _, ok := lfMap[episodeNum]; !ok {
					continue
				}
				episodeImageUrlsToDownload[episodeNum] = episodeImageUrl
			}
		}

		// Download the episode images if needed
		if len(episodeImageUrlsToDownload) > 0 {
			// Download only the episode images that we need to download
			episodeImagePaths, ok := DownloadAnimeEpisodeImages(m.logger, m.localAssetsDir, entry.Media.ID, episodeImageUrlsToDownload)
			if !ok {
				// DownloadAnimeEpisodeImages will log the error
				return
			}
			// Update the snapshot by adding the new episode images
			for episodeNum, episodeImagePath := range episodeImagePaths {
				snapshot.EpisodeImagePaths[episodeNum] = episodeImagePath
			}
		}

		// Save the snapshot
		err := m.localDb.SaveAnimeSnapshot(&snapshot)
		if err != nil {
			m.logger.Error().Err(err).Msgf("local manager: Failed to save anime snapshot for anime %d", entry.Media.ID)
		}
		return
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *ManagerImpl) ScanPlatform() error {
	if m.animeCollection.IsAbsent() {
		return fmt.Errorf("local manager: Anime collection not set")
	}

	m.loadLocalAnimeCollection()

	if localAnimeCollection, ok := m.localAnimeCollection.Get(); ok {

		for _, list := range localAnimeCollection.Lists {
			if list.Entries == nil {
				continue
			}
			for _, entry := range list.Entries {
				// Get the entry from account
				var originalEntry *platform.UnifiedCollectionEntry
				if e, found := m.animeCollection.MustGet().GetListEntryFromMediaId(entry.Media.ID); found {
					originalEntry = e
				}
				if originalEntry == nil {
					continue
				}

				key1 := GetAnimeListDataKey(entry)
				key2 := GetAnimeListDataKey(originalEntry)

				// If the entry is the same, skip
				if key1 == key2 {
					continue
				}

				var startDate *platform.FuzzyDate
				if entry.StartedAt != nil {
					startDate = entry.StartedAt
				}

				var endDate *platform.FuzzyDate
				if entry.CompletedAt != nil {
					endDate = entry.CompletedAt
				}

				var score *int
				if entry.Score != nil && *entry.Score != 0 {
					score = lo.ToPtr(int(*entry.Score))
				}

				_ = m.platformRef.UpdateEntry(
					context.Background(),
					entry.Media.ID,
					entry.Status,
					score,
					entry.Progress,
					startDate,
					endDate,
				)
			}
		}
	}

	m.RefreshPlatformCollectionsFunc()

	m.wsEventManager.SendEvent(events.RefreshedAnimeCollection, nil)

	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *ManagerImpl) loadTrackedMedia() (trackedAnimeMap map[int]*TrackedMedia) {
	trackedAnime, _ := m.localDb.GetAllTrackedMediaByType(AnimeType)

	trackedAnimeMap = make(map[int]*TrackedMedia)
	for _, item := range trackedAnime {
		trackedAnimeMap[item.MediaID] = item
	}

	return trackedAnimeMap
}

func (m *ManagerImpl) removeAnime(aId int) error {
	m.logger.Trace().Msgf("local manager: Removing anime %d from local database", aId)
	// Remove the tracked anime
	err := m.localDb.RemoveTrackedMedia(aId, AnimeType)
	if err != nil {
		return fmt.Errorf("local manager: Failed to remove anime %d from local database: %w", aId, err)
	}
	// Remove the anime snapshot
	_ = m.localDb.RemoveAnimeSnapshot(uint(aId))
	// Remove the images
	_ = m.removeMediaImages(aId)
	return nil
}

// removeMediaImages removes the images for the media with the given ID.
//   - The images are stored in the local assets' directory.
//   - e.g. datadir/local/assets/{mediaID}/*
func (m *ManagerImpl) removeMediaImages(mediaID int) error {
	m.logger.Trace().Msgf("local manager: Removing images for media %d", mediaID)
	path := filepath.Join(m.localAssetsDir, fmt.Sprintf("%d", mediaID))
	_ = os.RemoveAll(path)
	//if err != nil {
	//	return fmt.Errorf("local manager: Failed to remove images for media %d: %w", mediaID, err)
	//}
	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Avoids recalculating the size of the cache directory every time it is requested
var localStorageSizeCache atomic.Int64

func (m *ManagerImpl) GetLocalStorageSize() int64 {

	if size := localStorageSizeCache.Load(); size != 0 {
		return size
	}

	var size int64
	_ = filepath.WalkDir(m.localDir, func(path string, d os.DirEntry, err error) error {
		if d != nil && !d.IsDir() {
			if info, err := d.Info(); err == nil {
				size += info.Size()
			}
		}
		return nil
	})

	localStorageSizeCache.Store(size)

	return size
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *ManagerImpl) GetSimulatedAnimeCollection() mo.Option[*platform.UnifiedCollection] {
	ac, ok := m.localDb.GetSimulatedAnimeCollection()
	if !ok {
		return mo.None[*platform.UnifiedCollection]()
	}
	return mo.Some(ac)
}

func (m *ManagerImpl) SaveSimulatedAnimeCollection(ac *platform.UnifiedCollection) {
	m.logger.Trace().Msg("local manager: Saving simulated anime collection to database")
	//// Remove airing dates from each entry
	//for _, list := range ac.MediaListCollection.Lists {
	//	for _, entry := range list.Entries {
	//		entry.GetMedia().NextAiringEpisode = nil
	//	}
	//}
	_ = m.localDb.SaveSimulatedAnimeCollection(ac)
}

func (m *ManagerImpl) ScanPlatformToSimulatedCollection() error {
	m.logger.Trace().Msg("local manager: Synchronizing Platform to simulated (local) collection")

	if animeCollection, ok := m.animeCollection.Get(); ok {
		m.SaveSimulatedAnimeCollection(animeCollection)
	}

	return nil
}

func (m *ManagerImpl) ScanSimulatedCollectionToPlatform() error {
	if localAnimeCollection, ok := m.localDb.GetSimulatedAnimeCollection(); ok {
		for _, list := range localAnimeCollection.Lists {
			if list.Entries == nil {
				continue
			}
			for _, entry := range list.Entries {
				// Get the entry from account
				var originalEntry *platform.UnifiedCollectionEntry
				if e, found := m.animeCollection.MustGet().GetListEntryFromMediaId(entry.Media.ID); found {
					originalEntry = e
				}
				if originalEntry == nil {
					continue
				}

				key1 := GetAnimeListDataKey(entry)
				key2 := GetAnimeListDataKey(originalEntry)

				// If the entry is the same, skip
				if key1 == key2 {
					continue
				}

				var startDate *platform.FuzzyDate
				if entry.StartedAt != nil {
					startDate = entry.StartedAt
				}

				var endDate *platform.FuzzyDate
				if entry.CompletedAt != nil {
					endDate = entry.CompletedAt
				}

				var score *int
				if entry.Score != nil && *entry.Score != 0 {
					score = lo.ToPtr(int(*entry.Score))
				} else {
					score = lo.ToPtr(0)
				}

				_ = m.platformRef.UpdateEntry(
					context.Background(),
					entry.Media.ID,
					entry.Status,
					score,
					entry.Progress,
					startDate,
					endDate,
				)
			}
		}
	}

	m.RefreshPlatformCollectionsFunc()

	m.wsEventManager.SendEvent(events.RefreshedAnimeCollection, nil)

	return nil
}
