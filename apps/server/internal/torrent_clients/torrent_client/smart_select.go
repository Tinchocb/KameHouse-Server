package torrent_client

import (
	"context"
	"kamehouse/internal/api/anilist"
)

func (r *Repository) SmartSelectFile(ctx context.Context, media *anilist.CompleteAnime, episode int, torrent interface{}) (interface{}, error) {
	return nil, nil
}
