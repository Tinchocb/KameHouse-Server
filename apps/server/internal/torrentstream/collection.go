package torrentstream

import (
	"fmt"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/hook"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util"
	"strconv"
	"sync"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"

	"github.com/samber/lo"
)

type (
	// StreamCollection is used to "complete" the anime.LibraryCollection if the user chooses
	// to include torrent streams in the library view.
	StreamCollection struct {
		ContinueWatchingList []*anime.Episode             `json:"continueWatchingList"`
		Anime                []*models.LibraryMedia       `json:"anime"`
		ListData             map[int]*anime.EntryListData `json:"listData"`
	}

	HydrateStreamCollectionOptions struct {
		Database            *db.Database
		LibraryCollection   *anime.LibraryCollection
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
	}
)

func (r *Repository) HydrateStreamCollection(opts *HydrateStreamCollectionOptions) {

	reqEvent := new(anime.AnimeLibraryStreamCollectionRequestedEvent)
	reqEvent.Database = opts.Database
	reqEvent.LibraryCollection = opts.LibraryCollection
	err := hook.GlobalHookManager.OnAnimeLibraryStreamCollectionRequested().Trigger(reqEvent)
	if err != nil {
		return
	}
	opts.Database = reqEvent.Database
	opts.LibraryCollection = reqEvent.LibraryCollection

	entries, err := db.GetAllMediaEntryListData(opts.Database)
	if err != nil {
		return
	}

	currentlyWatching := make([]*models.MediaEntryListData, 0)
	for _, entry := range entries {
		if entry.Status == string(anilist.MediaListStatusCurrent) || entry.Status == string(anilist.MediaListStatusRepeating) {
			currentlyWatching = append(currentlyWatching, entry)
		}
	}

	if len(currentlyWatching) == 0 {
		return
	}

	ret := &StreamCollection{
		ContinueWatchingList: make([]*anime.Episode, 0),
		Anime:                make([]*models.LibraryMedia, 0),
		ListData:             make(map[int]*anime.EntryListData),
	}

	visitedMediaIds := make(map[int]struct{})

	animeAdded := make(map[int]*models.MediaEntryListData)

	// Go through each entry in the currently watching list
	wg := sync.WaitGroup{}
	mu := sync.Mutex{}
	wg.Add(len(currentlyWatching))
	for _, entry := range currentlyWatching {
		go func(entry *models.MediaEntryListData) {
			defer wg.Done()

			if entry == nil || entry.LibraryMedia == nil {
				return
			}

			mu.Lock()
			if _, found := visitedMediaIds[int(entry.LibraryMediaID)]; found {
				mu.Unlock()
				return
			}
			// Get the next episode to watch
			// i.e. if the user has watched episode 1, the next episode to watch is 2
			nextEpisodeToWatch := entry.Progress + 1

			mediaId := int(entry.LibraryMediaID)
			visitedMediaIds[mediaId] = struct{}{}
			mu.Unlock()
			// Check if the anime's "next episode to watch" is already in the library collection
			// If it is, we don't need to add it to the stream collection
			for _, libraryEp := range opts.LibraryCollection.ContinueWatchingList {
				if libraryEp.BaseAnime.ID == uint(mediaId) && libraryEp.GetProgressNumber() == nextEpisodeToWatch {
					return
				}
			}

			if entry.LibraryMedia.Status == string(anilist.MediaStatusNotYetReleased) {
				return
			}

			// Get the media info
			animeMetadata, err := opts.MetadataProviderRef.Get().GetAnimeMetadata(metadata.AnilistPlatform, mediaId)
			if err != nil {
				animeMetadata = anime.NewAnimeMetadataFromEpisodeCount(entry.LibraryMedia, lo.RangeFrom(1, nextEpisodeToWatch))
			}

			_, found := animeMetadata.FindEpisode(strconv.Itoa(nextEpisodeToWatch))

			progressOffset := 0
			anidbEpisode := strconv.Itoa(nextEpisodeToWatch)

			mediaWrapper := opts.MetadataProviderRef.Get().GetAnimeMetadataWrapper(nil, animeMetadata)

			// Add the anime & episode
			episode := anime.NewEpisode(&anime.NewEpisodeOptions{
				LocalFile:            nil,
				OptionalAniDBEpisode: anidbEpisode,
				AnimeMetadata:        animeMetadata,
				Media:                entry.LibraryMedia,
				ProgressOffset:       progressOffset,
				IsDownloaded:         false,
				MetadataProvider:     r.metadataProviderRef.Get(),
				MetadataWrapper:      mediaWrapper,
			})
			if !found {
				episode.EpisodeTitle = entry.LibraryMedia.TitleRomaji
				episode.DisplayTitle = fmt.Sprintf("Episode %d", nextEpisodeToWatch)
				episode.ProgressNumber = nextEpisodeToWatch
				episode.EpisodeNumber = nextEpisodeToWatch
				episode.EpisodeMetadata = &anime.EpisodeMetadata{
					Image: entry.LibraryMedia.BannerImage,
				}
			}

			if episode == nil {
				r.logger.Error().Msg("torrentstream: could not get anime entry episode")
				return
			}

			mu.Lock()
			ret.ContinueWatchingList = append(ret.ContinueWatchingList, episode)
			animeAdded[mediaId] = entry
			mu.Unlock()
		}(entry)
	}
	wg.Wait()

	libraryAnimeMap := make(map[int]struct{})

	// Remove anime that are already in the library collection
	for _, list := range opts.LibraryCollection.Lists {
		if list.Status == string(anilist.MediaListStatusCurrent) {
			for _, entry := range list.Entries {
				libraryAnimeMap[entry.MediaId] = struct{}{}
				if _, found := animeAdded[entry.MediaId]; found {
					delete(animeAdded, entry.MediaId)
				}
			}
		}
	}

	for _, entry := range currentlyWatching {
		if _, found := libraryAnimeMap[int(entry.LibraryMediaID)]; found {
			continue
		}
		if entry.LibraryMedia.Status == string(anilist.MediaStatusNotYetReleased) {
			continue
		}
		animeAdded[int(entry.LibraryMediaID)] = entry
	}

	for _, a := range animeAdded {
		ret.Anime = append(ret.Anime, a.LibraryMedia)
		ret.ListData[int(a.LibraryMediaID)] = anime.NewEntryListData(a)
	}

	if len(ret.ContinueWatchingList) == 0 && len(ret.Anime) == 0 {
		return
	}

	sc := &anime.StreamCollection{
		ContinueWatchingList: ret.ContinueWatchingList,
		Anime:                ret.Anime,
		ListData:             ret.ListData,
	}

	event := new(anime.AnimeLibraryStreamCollectionEvent)
	event.StreamCollection = sc
	err = hook.GlobalHookManager.OnAnimeLibraryStreamCollection().Trigger(event)
	if err != nil {
		return
	}

	opts.LibraryCollection.Stream = event.StreamCollection
}
