package torrentstream

import (
	"context"
	"kamehouse/internal/platforms/platform"
)

func (r *Repository) GetStreamHistory(ctx context.Context) ([]interface{}, error) {
	return nil, nil
}

func (r *Repository) AddStreamHistory(ctx context.Context, media *platform.UnifiedMedia, episode int, torrent interface{}) error {
	return nil
}

func (r *Repository) ClearStreamHistory(ctx context.Context) error {
	return nil
}
