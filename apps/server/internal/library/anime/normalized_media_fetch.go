package anime

import (
	"context"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util/limiter"
)

func FetchMediaTree(
	m *dto.NormalizedMedia,
	rel anilist.FetchMediaTreeRelation,
	anilistClient anilist.AnilistClient,
	rl *limiter.Limiter,
	tree *anilist.CompleteAnimeRelationTree,
	cache *anilist.CompleteAnimeCache,
) error {
	if m == nil {
		return nil
	}

	// Negative IDs belong to TMDB and cannot be fetched from AniList
	if m.ID <= 0 {
		return nil
	}

	rl.Wait(context.Background())
	res, err := anilistClient.CompleteAnimeByID(context.Background(), &m.ID)
	if err != nil {
		return err
	}
	return res.GetMedia().FetchMediaTree(rel, anilistClient, rl, tree, cache)
}
