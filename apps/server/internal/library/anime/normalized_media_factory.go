package anime

import (
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/platforms/platform"
)

func NewNormalizedMedia(m *platform.UnifiedMedia) *dto.NormalizedMedia {
	var startDate *dto.NormalizedMediaDate
	if m.StartDate != nil {
		startDate = &dto.NormalizedMediaDate{
			Year:  m.StartDate.Year,
			Month: m.StartDate.Month,
			Day:   m.StartDate.Day,
		}
	}

	var title *dto.NormalizedMediaTitle
	if m.Title != nil {
		title = &dto.NormalizedMediaTitle{
			Romaji:  m.Title.Romaji,
			English: m.Title.English,
			Native:  m.Title.Native,
		}
	}

	var coverImage *dto.NormalizedMediaCoverImage
	if m.CoverImage != nil {
		coverImage = &dto.NormalizedMediaCoverImage{
			ExtraLarge: m.CoverImage.ExtraLarge,
			Large:      m.CoverImage.Large,
			Medium:     m.CoverImage.Medium,
			Color:      m.CoverImage.Color,
		}
	}

	var nextAiringEpisode *dto.NormalizedMediaNextAiringEpisode
	if m.NextAiringEpisode != nil {
		nextAiringEpisode = &dto.NormalizedMediaNextAiringEpisode{
			AiringAt:        m.NextAiringEpisode.AiringAt,
			TimeUntilAiring: m.NextAiringEpisode.TimeUntilAiring,
			Episode:         m.NextAiringEpisode.Episode,
		}
	}

	id := m.ID
	if string(m.Format) == "MOVIE" && id < 1_000_000 {
		id += 1_000_000
	}

	return &dto.NormalizedMedia{
		ID:                id,
		Title:             title,
		Format:            (*dto.MediaFormat)(&m.Format),
		Status:            (*dto.MediaStatus)(&m.Status),
		Season:            (*dto.MediaSeason)(m.Season),
		Year:              m.SeasonYear,
		StartDate:         startDate,
		Episodes:          m.Episodes,
		BannerImage:       m.BannerImage,
		CoverImage:        coverImage,
		NextAiringEpisode: nextAiringEpisode,
		Runtime:           m.Runtime,
	}
}
