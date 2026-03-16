package local

import (
	"context"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"sync"

	"github.com/samber/lo"
)

// DEVNOTE: The synchronization process is split into 3 parts:
// 1. ManagerImpl.synchronize removes outdated tracked anime & manga, runs Syncer.runDiffs and adds changed tracked anime & manga to the queue.
// 2. The Syncer processes the queue, calling Syncer.synchronizeAnime and Syncer.synchronizeManga for each job.
// 3. Syncer.synchronizeCollections creates a local collection that mirrors the remote collection, containing only the tracked anime & manga. Only called when the queue is emptied.

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type (
	// Syncer will synchronize the anime and manga snapshots in the local database.
	// Anytime Manager.Synchronize is called, tracked anime and manga will be added to the queue.
	// The queue will synchronize one anime and one manga every X minutes, until it's empty.
	//
	// Synchronization can fail due to network issues. When it does, the anime or manga will be added to the failed queue.
	Syncer struct {
		animeJobQueue chan AnimeTask

		failedAnimeQueue *result.Cache[int, *platform.UnifiedCollectionEntry]

		trackedAnimeMap map[int]*TrackedMedia

		manager *ManagerImpl
		mu      sync.RWMutex

		shouldUpdateLocalCollections bool
		doneUpdatingLocalCollections chan struct{}

		queueState   QueueState
		queueStateMu sync.RWMutex
	}

	QueueState struct {
		AnimeTasks map[int]*QueueMediaTask `json:"animeTasks"`
	}

	QueueMediaTask struct {
		MediaId int    `json:"mediaId"`
		Image   string `json:"image"`
		Title   string `json:"title"`
		Type    string `json:"type"`
	}
	AnimeTask struct {
		Diff *AnimeDiffResult
	}
)

func NewQueue(manager *ManagerImpl) *Syncer {
	ret := &Syncer{
		animeJobQueue:                make(chan AnimeTask, 100),
		failedAnimeQueue:             result.NewCache[int, *platform.UnifiedCollectionEntry](),
		shouldUpdateLocalCollections: false,
		doneUpdatingLocalCollections: make(chan struct{}, 1),
		manager:                      manager,
		mu:                           sync.RWMutex{},
		queueState: QueueState{
			AnimeTasks: make(map[int]*QueueMediaTask),
		},
		queueStateMu: sync.RWMutex{},
	}

	go ret.processAnimeJobs()

	return ret
}

func (q *Syncer) GetQueueState() QueueState {
	q.queueStateMu.RLock()
	defer q.queueStateMu.RUnlock()
	return q.queueState
}


func (q *Syncer) processAnimeJobs() {
	for job := range q.animeJobQueue {

		q.queueStateMu.Lock()
		q.queueState.AnimeTasks[job.Diff.AnimeEntry.Media.ID] = &QueueMediaTask{
			MediaId: job.Diff.AnimeEntry.Media.ID,
			Image:   job.Diff.AnimeEntry.Media.GetCoverImageSafe(),
			Title:   job.Diff.AnimeEntry.Media.GetTitleSafe(),
			Type:    "anime",
		}
		q.SendQueueStateToClient()
		q.queueStateMu.Unlock()

		q.shouldUpdateLocalCollections = true
		q.synchronizeAnime(job.Diff)

		q.queueStateMu.Lock()
		delete(q.queueState.AnimeTasks, job.Diff.AnimeEntry.Media.ID)
		q.SendQueueStateToClient()
		q.queueStateMu.Unlock()

		if len(q.animeJobQueue) == 0 && q.shouldUpdateLocalCollections {
			q.shouldUpdateLocalCollections = false
			_ = q.synchronizeCollections()
			select {
			case q.doneUpdatingLocalCollections <- struct{}{}:
			default:
			}
		}
	}
}

func (q *Syncer) synchronizeAnime(diff *AnimeDiffResult) {
	entry := diff.AnimeEntry
	lfs := lo.Filter(q.manager.localFiles, func(lf *dto.LocalFile, _ int) bool {
		return lf.MediaId == entry.Media.ID
	})

	var animeMetadata *metadata.AnimeMetadata
	var metadataWrapper metadata_provider.AnimeMetadataWrapper
	if diff.DiffType == DiffTypeMissing || diff.DiffType == DiffTypeMetadata {
		// Get the anime metadata
		var err error
		animeMetadata, err = q.manager.metadataProviderRef.Get().GetAnimeMetadata(entry.Media.ID)
		if err != nil {
			// If the anime metadata doesn't exist, create a fake one
			simpleEntry, err := anime.NewSimpleEntry(context.Background(), &anime.NewSimpleAnimeEntryOptions{
				MediaId:             entry.Media.ID,
				LocalFiles:          lfs,
				Database:            nil,
				PlatformRef:         q.manager.platformRef,
				MetadataProviderRef: q.manager.metadataProviderRef,
			})
			if err != nil {
				q.sendAnimeToFailedQueue(entry)
				q.manager.logger.Error().Err(err).Msgf("local manager: Failed to get metadata for anime %d", entry.Media.ID)
				return
			}

			animeMetadata = anime.NewAnimeMetadataFromEntry(models.ToLibraryMedia(entry.Media), simpleEntry.Episodes)
		}
		metadataWrapper = q.manager.metadataProviderRef.Get().GetAnimeMetadataWrapper(entry.Media, animeMetadata)
	}

	//
	// The snapshot is missing
	//
	if diff.DiffType == DiffTypeMissing && animeMetadata != nil {
		bannerImage, coverImage, episodeImagePaths, ok := DownloadAnimeImages(q.manager.logger, q.manager.localAssetsDir, entry, animeMetadata, metadataWrapper, lfs)
		if !ok {
			q.sendAnimeToFailedQueue(entry)
			return
		}

		// Create a new snapshot
		snapshot := &AnimeSnapshot{
			MediaId:           entry.Media.ID,
			AnimeMetadata:     LocalAnimeMetadata(*animeMetadata),
			BannerImagePath:   bannerImage,
			CoverImagePath:    coverImage,
			EpisodeImagePaths: episodeImagePaths,
			ReferenceKey:      GetAnimeReferenceKey(entry.Media, q.manager.localFiles),
		}

		// Save the snapshot
		err := q.manager.localDb.SaveAnimeSnapshot(snapshot)
		if err != nil {
			q.sendAnimeToFailedQueue(entry)
			q.manager.logger.Error().Err(err).Msgf("local manager: Failed to save anime snapshot for anime %d", entry.Media.ID)
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
		snapshot.ReferenceKey = GetAnimeReferenceKey(entry.Media, q.manager.localFiles)

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
			episodeImagePaths, ok := DownloadAnimeEpisodeImages(q.manager.logger, q.manager.localAssetsDir, entry.Media.ID, episodeImageUrlsToDownload)
			if !ok {
				// DownloadAnimeEpisodeImages will log the error
				q.sendAnimeToFailedQueue(entry)
				return
			}
			// Update the snapshot by adding the new episode images
			for episodeNum, episodeImagePath := range episodeImagePaths {
				snapshot.EpisodeImagePaths[episodeNum] = episodeImagePath
			}
		}

		// Save the snapshot
		err := q.manager.localDb.SaveAnimeSnapshot(&snapshot)
		if err != nil {
			q.sendAnimeToFailedQueue(entry)
			q.manager.logger.Error().Err(err).Msgf("local manager: Failed to save anime snapshot for anime %d", entry.Media.ID)
		}
		return
	}
}

func (q *Syncer) synchronizeCollections() (err error) {
	defer util.HandlePanicInModuleWithError("sync/synchronizeCollections", &err)

	q.manager.loadTrackedMedia()

	// DEVNOTE: "_" prefix = original/remote collection
	// We shouldn't modify the remote collection, so making sure we get new pointers

	q.manager.logger.Trace().Msg("local manager: Synchronizing local collections")

	_animeCollection := q.manager.animeCollection.MustGet()

	animeSnapshots, _ := q.manager.localDb.GetAnimeSnapshots()
	animeSnapshotMap := make(map[int]*AnimeSnapshot)
	for _, snapshot := range animeSnapshots {
		animeSnapshotMap[snapshot.MediaId] = snapshot
	}

	localAnimeCollection := &platform.UnifiedCollection{
		Lists: make([]*platform.UnifiedCollectionList, 0),
	}
	for _, _animeList := range _animeCollection.Lists {
		localAnimeCollection.Lists = append(localAnimeCollection.Lists, &platform.UnifiedCollectionList{
			Status:  _animeList.Status,
			Entries: make([]*platform.UnifiedCollectionEntry, 0),
		})
	}

	if len(animeSnapshots) > 0 {
		// Create local anime collection
		for _, _animeList := range _animeCollection.Lists {
			for _, _animeEntry := range _animeList.Entries {
				// Check if the anime is tracked
				_, found := q.trackedAnimeMap[_animeEntry.Media.ID]
				if !found {
					continue
				}
				// Get the anime snapshot
				snapshot, found := animeSnapshotMap[_animeEntry.Media.ID]
				if !found {
					continue
				}

				// Add the anime to the right list
				for _, list := range localAnimeCollection.Lists {
					if list.Status == _animeList.Status {
						// Create a new entry and modify it with local snapshot data
						entry := *_animeEntry
						entry.Media = _animeEntry.Media // We keep the media pointer
						entry.Media.Episodes = lo.ToPtr(snapshot.AnimeMetadata.EpisodeCount)

						list.Entries = append(list.Entries, &entry)
						break
					}
				}
			}
		}
	}

	q.manager.UpdateLocalAnimeCollection(localAnimeCollection)

	return nil
}

func (q *Syncer) SendQueueStateToClient() {
	q.queueStateMu.RLock()
	defer q.queueStateMu.RUnlock()
	q.manager.wsEventManager.SendEvent(events.LocalGetSyncQueueStateEndpoint, q.queueState)
}
 
func (q *Syncer) runDiffs(trackedAnimeMap map[int]*TrackedMedia, animeSnapshotMap map[int]*AnimeSnapshot, localFiles []*dto.LocalFile) {
	q.mu.Lock()
	q.trackedAnimeMap = trackedAnimeMap
	q.mu.Unlock()
 
	diff := &Diff{Logger: q.manager.logger}
	animeDiffs := diff.GetAnimeDiffs(GetAnimeDiffOptions{
		Collection:      q.manager.animeCollection.MustGet(),
		LocalCollection: q.manager.localAnimeCollection,
		LocalFiles:      localFiles,
		TrackedAnime:    trackedAnimeMap,
		Snapshots:       animeSnapshotMap,
	})
 
	for _, d := range animeDiffs {
		q.animeJobQueue <- AnimeTask{Diff: d}
	}
}
 
func (q *Syncer) refreshCollections() {
	_ = q.synchronizeCollections()
}

func (q *Syncer) sendAnimeToFailedQueue(entry *platform.UnifiedCollectionEntry) {
	q.failedAnimeQueue.Set(entry.Media.ID, entry)
}
