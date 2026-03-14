package shared_platform

import (
	"context"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/platforms/platform"
)

type PlatformHelper struct {
}

func NewPlatformHelper(extensionBankRef interface{}, db interface{}, logger interface{}) *PlatformHelper {
	return &PlatformHelper{}
}

func (h *PlatformHelper) Close()      {}
func (h *PlatformHelper) ClearCache() {}

// Updated stubs with proper types and return values
func (h *PlatformHelper) TriggerUpdateEntryHooks(ctx context.Context, mediaID int, status *anilist.MediaListStatus, scoreRaw *int, progress *int, startedAt *anilist.FuzzyDateInput, completedAt *anilist.FuzzyDateInput, fn func(event *platform.PreUpdateEntryEvent) error) error {
	return fn(&platform.PreUpdateEntryEvent{Status: status, ScoreRaw: scoreRaw, Progress: progress, StartedAt: startedAt, CompletedAt: completedAt})
}
func (h *PlatformHelper) HandleCustomSourceUpdateEntry(ctx context.Context, mediaID int, status *anilist.MediaListStatus, scoreRaw *int, progress *int, startedAt *anilist.FuzzyDateInput, completedAt *anilist.FuzzyDateInput) (bool, error) {
	return false, nil
}
func (h *PlatformHelper) TriggerUpdateEntryProgressHooks(ctx context.Context, mediaID int, progress int, totalEpisodes *int, fn func(event *platform.PreUpdateEntryProgressEvent) error) error {
	return fn(&platform.PreUpdateEntryProgressEvent{Progress: &progress, TotalCount: totalEpisodes})
}
func (h *PlatformHelper) HandleCustomSourceUpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalCount *int) (bool, error) {
	return false, nil
}
func (h *PlatformHelper) TriggerUpdateEntryRepeatHooks(ctx context.Context, mediaID int, repeat int, fn func(event *platform.PreUpdateEntryRepeatEvent) error) error {
	return fn(&platform.PreUpdateEntryRepeatEvent{Repeat: &repeat})
}
func (h *PlatformHelper) HandleCustomSourceUpdateEntryRepeat(ctx context.Context, mediaID int, repeat int) (bool, error) {
	return false, nil
}
func (h *PlatformHelper) TriggerDeleteEntryHooks(ctx context.Context, mediaId, entryId int, fn func(event *platform.PreDeleteEntryEvent) error) error {
	return fn(&platform.PreDeleteEntryEvent{MediaID: &mediaId, EntryID: &entryId})
}
func (h *PlatformHelper) HandleCustomSourceDeleteEntry(ctx context.Context, mediaID int, entryID int) (bool, error) {
	return false, nil
}
func (h *PlatformHelper) GetCachedBaseAnime(mediaID int) (*anilist.BaseAnime, bool) {
	return nil, false
}
func (h *PlatformHelper) TriggerGetAnimeEvent(media *anilist.BaseAnime) (*anilist.BaseAnime, error) {
	return media, nil
}
func (h *PlatformHelper) HandleCustomSourceAnime(ctx context.Context, mediaID int) (*anilist.BaseAnime, bool, error) {
	return nil, false, nil
}
func (h *PlatformHelper) SetCachedBaseAnime(mediaID int, media *anilist.BaseAnime) {}
func (h *PlatformHelper) HandleCustomSourceAnimeDetails(ctx context.Context, mediaID int) (*anilist.AnimeDetailsById_Media, bool, error) {
	return nil, false, nil
}
func (h *PlatformHelper) TriggerGetAnimeDetailsEvent(media *anilist.AnimeDetailsById_Media) (*anilist.AnimeDetailsById_Media, error) {
	return media, nil
}
func (h *PlatformHelper) GetCachedCompleteAnime(mediaID int) (*anilist.CompleteAnime, bool) {
	return nil, false
}
func (h *PlatformHelper) HandleCustomSourceAnimeWithRelations(ctx context.Context, mediaID int) (*anilist.CompleteAnime, bool, error) {
	return nil, false, nil
}
func (h *PlatformHelper) SetCachedCompleteAnime(mediaID int, media *anilist.CompleteAnime) {}
func (h *PlatformHelper) TriggerGetMangaEvent(media *anilist.BaseManga) (*anilist.BaseManga, error) {
	return media, nil
}
func (h *PlatformHelper) GetCachedBaseManga(mediaID int) (*anilist.BaseManga, bool) {
	return nil, false
}
func (h *PlatformHelper) HandleCustomSourceManga(ctx context.Context, mediaID int) (*anilist.BaseManga, bool, error) {
	return nil, false, nil
}
func (h *PlatformHelper) SetCachedBaseManga(mediaID int, media *anilist.BaseManga) {}
func (h *PlatformHelper) HandleCustomSourceMangaDetails(ctx context.Context, mediaID int) (*anilist.MangaDetailsById_Media, bool, error) {
	return nil, false, nil
}
func (h *PlatformHelper) MergeCustomSourceAnimeEntries(collection interface{}) {}
func (h *PlatformHelper) TriggerGetStudioDetailsEvent(ret *anilist.StudioDetails) (*anilist.StudioDetails, error) {
	return ret, nil
}
func (h *PlatformHelper) BuildAnimeAiringSchedule(ctx context.Context, collection interface{}, client interface{}) (*anilist.AnimeAiringSchedule, error) {
	return nil, nil
}

// Fixed signatures to avoid type truncation/misalignment
func (h *PlatformHelper) FilterOutCustomAnimeLists(lists []*anilist.AnimeCollection_MediaListCollection_Lists) []*anilist.AnimeCollection_MediaListCollection_Lists {
	return lists
}
func (h *PlatformHelper) FilterOutCustomMangaLists(lists []*anilist.MangaCollection_MediaListCollection_Lists) []*anilist.MangaCollection_MediaListCollection_Lists {
	return lists
}
func (h *PlatformHelper) RemoveNovelsFromMangaCollection(collection *anilist.MangaCollection) {}
