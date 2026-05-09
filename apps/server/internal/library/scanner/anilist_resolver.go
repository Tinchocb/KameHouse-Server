package scanner

import (
	"context"
	"fmt"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/metadata"
	"kamehouse/internal/util/result"
	"sync"
)

type AnilistResolver struct {
	provider *metadata.AniListProvider
	cache    *result.Cache[int, *dto.NormalizedMedia]
	mu       sync.Mutex
}

func NewAnilistResolver() *AnilistResolver {
	return &AnilistResolver{
		provider: metadata.NewAniListProvider(),
		cache:    result.NewCache[int, *dto.NormalizedMedia](),
	}
}

// ResolveAbsoluteMapping attempts to find the correct seasonal entry for a given absolute episode number.
// It starts from a baseMedia (usually the first season) and traverses PREQUEL/SEQUEL relations.
func (r *AnilistResolver) ResolveAbsoluteMapping(ctx context.Context, baseMediaId int, absoluteEpisode int) (*dto.NormalizedMedia, int, error) {
	// First, fetch the base media
	baseMedia, err := r.getMedia(ctx, baseMediaId)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch base media: %w", err)
	}

	// Calculate the total episode count so far
	// Many long-running series on AniList (like One Piece) just use continuous numbering.
	// If the absolute episode is within the known episodes of the base media, return it directly.
	if baseMedia.Episodes != nil && absoluteEpisode <= *baseMedia.Episodes {
		return baseMedia, absoluteEpisode, nil
	}
	
	// If it's currently airing and we don't have an episode limit, but the next airing episode is > absoluteEpisode, it's this media
	if baseMedia.Episodes == nil && baseMedia.NextAiringEpisode != nil && absoluteEpisode <= baseMedia.NextAiringEpisode.Episode {
		return baseMedia, absoluteEpisode, nil
	}

	// We need to traverse relations to build a timeline.
	// AniList relations are typically SEQUEL or PREQUEL.
	// We'll build a chain of sequels starting from the base.
	// Note: Building a perfect absolute mapper from AniList relations is complex because of OVAs/Spin-offs.
	// We'll focus on main SEQUELs that are TV or TV_SHORT formats.
	
	currentMedia := baseMedia
	accumulatedEpisodes := 0

	// Walk backwards to find the true prequel (start of the series)
	startMedia := r.findRootPrequel(ctx, baseMedia)
	
	currentMedia = startMedia
	
	for currentMedia != nil {
		// Calculate bounds for current media
		episodesInCurrent := 0
		if currentMedia.Episodes != nil {
			episodesInCurrent = *currentMedia.Episodes
		} else if currentMedia.NextAiringEpisode != nil {
			episodesInCurrent = currentMedia.NextAiringEpisode.Episode - 1
		} else {
			// Unknown episode count (e.g. newly airing without known limits)
			// Assume it fits here.
			return currentMedia, absoluteEpisode - accumulatedEpisodes, nil
		}

		// Check if the absolute episode falls within this season
		if absoluteEpisode <= accumulatedEpisodes + episodesInCurrent {
			relativeEpisode := absoluteEpisode - accumulatedEpisodes
			return currentMedia, relativeEpisode, nil
		}

		accumulatedEpisodes += episodesInCurrent

		// Find the next sequel
		currentMedia = r.findNextSequel(ctx, currentMedia)
	}

	// If we exhausted all sequels and still didn't find it, it might be an ongoing series 
	// where the latest season hasn't updated its episode count yet.
	// We return the last known media in the chain.
	return baseMedia, absoluteEpisode, fmt.Errorf("absolute episode out of bounds")
}

func (r *AnilistResolver) getMedia(ctx context.Context, id int) (*dto.NormalizedMedia, error) {
	if cached, ok := r.cache.Get(id); ok {
		return cached, nil
	}
	media, err := r.provider.GetMediaDetails(ctx, fmt.Sprintf("%d", id))
	if err != nil {
		return nil, err
	}
	r.cache.Set(id, media)
	return media, nil
}

func (r *AnilistResolver) findRootPrequel(ctx context.Context, media *dto.NormalizedMedia) *dto.NormalizedMedia {
	visited := make(map[int]bool)
	current := media

	for {
		visited[current.ID] = true
		var prequelNode *dto.NormalizedMediaRelation
		
		for _, rel := range current.Relations {
			if rel.RelationType == "PREQUEL" {
				if rel.Media != nil && (rel.Media.Format == nil || *rel.Media.Format == dto.MediaFormatTV || *rel.Media.Format == dto.MediaFormatTVShort) {
					prequelNode = rel
					break
				}
			}
		}

		if prequelNode == nil {
			break // No more prequels
		}

		if visited[prequelNode.Media.ID] {
			break // Cycle detected
		}

		// Fetch full details of the prequel
		fullPrequel, err := r.getMedia(ctx, prequelNode.Media.ID)
		if err != nil {
			break
		}
		current = fullPrequel
	}

	return current
}

func (r *AnilistResolver) findNextSequel(ctx context.Context, media *dto.NormalizedMedia) *dto.NormalizedMedia {
	for _, rel := range media.Relations {
		if rel.RelationType == "SEQUEL" {
			// We only follow TV series for absolute numbering
			if rel.Media != nil && (rel.Media.Format == nil || *rel.Media.Format == dto.MediaFormatTV || *rel.Media.Format == dto.MediaFormatTVShort) {
				fullSequel, err := r.getMedia(ctx, rel.Media.ID)
				if err == nil {
					return fullSequel
				}
			}
		}
	}
	return nil
}
