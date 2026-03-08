package dto

import (
	"kamehouse/internal/util/comparison"

	"github.com/samber/lo"
)

// Helper methods

func GetTitleSafe(m *NormalizedMedia) string {
	if m.Title == nil {
		return ""
	}
	if m.Title.UserPreferred != nil {
		return *m.Title.UserPreferred
	}
	if m.Title.English != nil {
		return *m.Title.English
	}
	if m.Title.Romaji != nil {
		return *m.Title.Romaji
	}
	if m.Title.Native != nil {
		return *m.Title.Native
	}
	return ""
}

func HasRomajiTitle(m *NormalizedMedia) bool {
	return m.Title != nil && m.Title.Romaji != nil
}

func HasEnglishTitle(m *NormalizedMedia) bool {
	return m.Title != nil && m.Title.English != nil
}

func HasSynonyms(m *NormalizedMedia) bool {
	return len(m.Synonyms) > 0
}

func GetAllTitles(m *NormalizedMedia) []*string {
	titles := make([]*string, 0)
	if m.Title == nil {
		return titles
	}
	if m.Title.Romaji != nil {
		titles = append(titles, m.Title.Romaji)
	}
	if m.Title.English != nil {
		titles = append(titles, m.Title.English)
	}
	if m.Title.Native != nil {
		titles = append(titles, m.Title.Native)
	}
	if m.Title.UserPreferred != nil {
		titles = append(titles, m.Title.UserPreferred)
	}
	titles = append(titles, m.Synonyms...)
	return titles
}

// GetPossibleSeasonNumber returns the possible season number for that media and -1 if it doesn't have one.
// It looks at the synonyms and returns the highest season number found.
func GetPossibleSeasonNumber(m *NormalizedMedia) int {
	if m == nil || len(m.Synonyms) == 0 {
		return -1
	}
	titles := lo.Filter(m.Synonyms, func(s *string, i int) bool { return comparison.ValueContainsSeason(*s) })
	if HasEnglishTitle(m) {
		titles = append(titles, m.Title.English)
	}
	if HasRomajiTitle(m) {
		titles = append(titles, m.Title.Romaji)
	}
	seasons := lo.Map(titles, func(s *string, i int) int { return comparison.ExtractSeasonNumber(*s) })
	return lo.Max(seasons)
}

// GetCurrentEpisodeCount returns the current episode number for that media and -1 if it doesn't have one.
// i.e. -1 is returned if the media has no episodes AND the next airing episode is not set.
func GetCurrentEpisodeCount(m *NormalizedMedia) int {
	ceil := -1
	if m.Episodes != nil {
		ceil = *m.Episodes
	}
	if m.NextAiringEpisode != nil {
		if m.NextAiringEpisode.Episode > 0 {
			ceil = m.NextAiringEpisode.Episode - 1
		}
	}
	return ceil
}

// GetTotalEpisodeCount returns the total episode number for that media and -1 if it doesn't have one
func GetTotalEpisodeCount(m *NormalizedMedia) int {
	ceil := -1
	if m.Episodes != nil {
		ceil = *m.Episodes
	}
	return ceil
}
