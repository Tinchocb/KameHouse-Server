package models

import (
	"encoding/json"
	"kamehouse/internal/platforms/platform"
	"time"
)

func (s *Settings) GetLibrary() *LibrarySettings {
	if s == nil {
		return &LibrarySettings{}
	}
	return &s.Library
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func ToLibraryMedia(m *platform.UnifiedMedia) *LibraryMedia {
	if m == nil {
		return nil
	}
	lm := &LibraryMedia{
		BaseModel: BaseModel{
			ID: uint(m.ID),
		},
		Type:   string(m.Type),
		Format: string(m.Format),
		Status: string(m.Status),
	}
	if m.Title != nil {
		if m.Title.Romaji != nil {
			lm.TitleRomaji = *m.Title.Romaji
		}
		if m.Title.English != nil {
			lm.TitleEnglish = *m.Title.English
		}
		if m.Title.Spanish != nil {
			lm.TitleSpanish = *m.Title.Spanish
		}
		if m.Title.Native != nil {
			lm.TitleOriginal = *m.Title.Native
		}
	}
	if m.CoverImage != nil {
		lm.PosterImage = m.GetCoverImageSafe()
	}
	if m.BannerImage != nil {
		lm.BannerImage = *m.BannerImage
	}
	if m.Episodes != nil {
		lm.TotalEpisodes = *m.Episodes
	}
	if m.StartDate != nil {
		lm.StartDate = time.Date(
			loValue(m.StartDate.Year, 0),
			time.Month(loValue(m.StartDate.Month, 1)),
			loValue(m.StartDate.Day, 1),
			0, 0, 0, 0, time.UTC,
		)
		lm.Year = loValue(m.StartDate.Year, 0)
	}
	if m.Runtime != nil {
		lm.Runtime = *m.Runtime
	}
	if m.Description != nil {
		lm.Description = *m.Description
	}
	if m.Score != nil {
		lm.Score = *m.Score
	}
	if len(m.Genres) > 0 {
		if b, err := json.Marshal(m.Genres); err == nil {
			lm.Genres = b
		}
	}
	return lm
}

func loValue[T any](v *T, fallback T) T {
	if v == nil {
		return fallback
	}
	return *v
}
