package anime

import (
	"context"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util/limiter"
)

func NewNormalizedMedia(m *anilist.BaseAnime) *dto.NormalizedMedia {
	var startDate *dto.NormalizedMediaDate
	if m.GetStartDate() != nil {
		startDate = &dto.NormalizedMediaDate{
			Year:  m.GetStartDate().GetYear(),
			Month: m.GetStartDate().GetMonth(),
			Day:   m.GetStartDate().GetDay(),
		}
	}

	var title *dto.NormalizedMediaTitle
	if m.GetTitle() != nil {
		title = &dto.NormalizedMediaTitle{
			Romaji:        m.GetTitle().GetRomaji(),
			English:       m.GetTitle().GetEnglish(),
			Native:        m.GetTitle().GetNative(),
			UserPreferred: m.GetTitle().GetUserPreferred(),
		}
	}

	var coverImage *dto.NormalizedMediaCoverImage
	if m.GetCoverImage() != nil {
		coverImage = &dto.NormalizedMediaCoverImage{
			ExtraLarge: m.GetCoverImage().GetExtraLarge(),
			Large:      m.GetCoverImage().GetLarge(),
			Medium:     m.GetCoverImage().GetMedium(),
			Color:      m.GetCoverImage().GetColor(),
		}
	}

	var nextAiringEpisode *dto.NormalizedMediaNextAiringEpisode
	if m.GetNextAiringEpisode() != nil {
		nextAiringEpisode = &dto.NormalizedMediaNextAiringEpisode{
			AiringAt:        m.GetNextAiringEpisode().GetAiringAt(),
			TimeUntilAiring: m.GetNextAiringEpisode().GetTimeUntilAiring(),
			Episode:         m.GetNextAiringEpisode().GetEpisode(),
		}
	}

	return &dto.NormalizedMedia{
		ID:                m.GetID(),
		IdMal:             m.GetIDMal(),
		Title:             title,
		Synonyms:          m.GetSynonyms(),
		Format:            (*dto.MediaFormat)(m.GetFormat()),
		Status:            (*dto.MediaStatus)(m.GetStatus()),
		Season:            (*dto.MediaSeason)(m.GetSeason()),
		Year:              m.GetSeasonYear(),
		StartDate:         startDate,
		Episodes:          m.GetEpisodes(),
		BannerImage:       m.GetBannerImage(),
		CoverImage:        coverImage,
		NextAiringEpisode: nextAiringEpisode,
		// fetched: true is internal to dto, let's assume we can't set it directly if it's lowercase
		// Wait, fetched is lowercase in dto.NormalizedMedia, so we can't set it from outside.
		// Let's create a setter in dto or use a constructor in dto.
	}
}

func FetchNormalizedMedia(anilistClient anilist.AnilistClient, l *limiter.Limiter, cache *anilist.CompleteAnimeCache, m *dto.NormalizedMedia) error {
	if anilistClient == nil || m == nil {
		return nil
	}

	if dto.IsNormalizedMediaFetched(m) {
		return nil
	}

	// Negative IDs belong to TMDB and cannot be fetched from AniList
	if m.ID <= 0 {
		return nil
	}

	if cache != nil {
		if complete, found := cache.Get(m.ID); found {
			*m = *NewNormalizedMedia(complete.ToBaseAnime())
		}
	}

	l.Wait(context.Background())
	complete, err := anilistClient.CompleteAnimeByID(context.Background(), &m.ID)
	if err != nil {
		return err
	}

	if cache != nil {
		cache.Set(m.ID, complete.GetMedia())
	}
	*m = *NewNormalizedMedia(complete.GetMedia().ToBaseAnime())
	dto.SetNormalizedMediaFetched(m, true)
	return nil
}
