package dto

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

func GetAllTitles(m *NormalizedMedia) []*string {
	if m.Title == nil {
		return make([]*string, 0)
	}
	titles := make([]*string, 0, 4+len(m.Synonyms))
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
