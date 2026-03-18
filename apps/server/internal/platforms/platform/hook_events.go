package platform

import (
	"kamehouse/internal/hook_resolver"
)

/////////////////////////////
// Platform Events
/////////////////////////////

type GetAnimeEvent struct {
	hook_resolver.Event
	Anime interface{} `json:"anime"`
}

type GetAnimeDetailsEvent struct {
	hook_resolver.Event
	Anime interface{} `json:"anime"`
}


type GetCachedAnimeCollectionEvent struct {
	hook_resolver.Event
	AnimeCollection interface{} `json:"animeCollection"`
}


type GetAnimeCollectionEvent struct {
	hook_resolver.Event
	AnimeCollection interface{} `json:"animeCollection"`
}


type GetCachedRawAnimeCollectionEvent struct {
	hook_resolver.Event
	AnimeCollection interface{} `json:"animeCollection"`
}


type GetRawAnimeCollectionEvent struct {
	hook_resolver.Event
	AnimeCollection interface{} `json:"animeCollection"`
}


type GetStudioDetailsEvent struct {
	hook_resolver.Event
	Studio interface{} `json:"studio"`
}

// PreUpdateEntryEvent is triggered when an entry is about to be updated.
// Prevent default to skip the default update and override the update.
type PreUpdateEntryEvent struct {
	hook_resolver.Event
	MediaID     *int        `json:"mediaId"`
	Status      interface{} `json:"status"`
	ScoreRaw    *int        `json:"scoreRaw"`
	Progress    *int        `json:"progress"`
	StartedAt   interface{} `json:"startedAt"`
	CompletedAt interface{} `json:"completedAt"`
}

type PostUpdateEntryEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
}

// PreUpdateEntryProgressEvent is triggered when an entry's progress is about to be updated.
// Prevent default to skip the default update and override the update.
type PreUpdateEntryProgressEvent struct {
	hook_resolver.Event
	MediaID    *int `json:"mediaId"`
	Progress   *int `json:"progress"`
	TotalCount *int `json:"totalCount"`
	Status     interface{} `json:"status"`
}

type PostUpdateEntryProgressEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
}

// PreUpdateEntryRepeatEvent is triggered when an entry's repeat is about to be updated.
// Prevent default to skip the default update and override the update.
type PreUpdateEntryRepeatEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
	Repeat  *int `json:"repeat"`
}

type PostUpdateEntryRepeatEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
}

// PreDeleteEntryEvent is triggered when an entry is about to be deleted.
// Prevent default to skip the default deletion and override the deletion.
type PreDeleteEntryEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
	EntryID *int `json:"entryId"`
}

type PostDeleteEntryEvent struct {
	hook_resolver.Event
	MediaID *int `json:"mediaId"`
	EntryID *int `json:"entryId"`
}
