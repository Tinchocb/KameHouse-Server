package platform

import (
	"context"
)

type Platform interface {
	// UpdateEntryProgress updates the entry progress for the given media ID
	UpdateEntryProgress(context context.Context, mediaID int, progress int, totalEpisodes *int) error
	// GetAnime gets the anime for the given media ID
	GetAnime(context context.Context, mediaID int) (interface{}, error)

	// GetAnimeCollection gets the anime collection without custom lists
	GetAnimeCollection(context context.Context, bypassCache bool) (interface{}, error)

	// AddMediaToCollection adds the media to the collection
	AddMediaToCollection(context context.Context, mIds []int) error
	// RefreshAnimeCollection refreshes the anime collection
	RefreshAnimeCollection(context context.Context) (interface{}, error)
}
