package torrentstream

import (
	"context"
	"kamehouse/internal/api/anilist"
)

type StartStreamOptions struct {
	Media        *anilist.CompleteAnime
	AniDbEpisode string
	EpisodeNumber int
	Torrent       interface{}
	FileIndex     *int
}

func (r *Repository) StartStream(ctx context.Context, opts *StartStreamOptions) error {
	return nil
}
