package platform

import (
	"context"
)

type Platform interface {
	// GetAnimeCollection gets the anime collection without custom lists
	GetAnimeCollection(context context.Context, bypassCache bool) (interface{}, error)

	// AddMediaToCollection adds the media to the collection
	AddMediaToCollection(context context.Context, mIds []int) error
	// RefreshAnimeCollection refreshes the anime collection
	RefreshAnimeCollection(context context.Context) (interface{}, error)
}
