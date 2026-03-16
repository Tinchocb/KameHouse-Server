package torrentstream

import (
	"context"
	"kamehouse/internal/platforms/platform"
)

type StartStreamOptions struct {
	Media        *platform.UnifiedMedia
	AniDbEpisode string
	EpisodeNumber int
	Torrent       interface{}
	FileIndex     *int
}

func (r *Repository) StartStream(ctx context.Context, opts *StartStreamOptions) error {
	return nil
}
