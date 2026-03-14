package local

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func EnsureUserAnimeEntry(ctx context.Context, database *db.Database, mediaID int) (*models.UserAnime, error) {
	// customsource check removed
	return nil, nil
}
