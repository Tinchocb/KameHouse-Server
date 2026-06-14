// Package lore provides functions to load, query, and manage Dragon Ball universe lore and sagas data.
package lore

import (
	_ "embed"
	"encoding/json"
	"strconv"
	"strings"
	"sync"
)

//go:embed dragonball_lore.json
var dragonBallLoreJSON []byte

type LoreWiki struct {
	Universe          string           `json:"universe"`
	SagasWiki         []SeriesSagas    `json:"sagas_wiki"`
	CharactersWiki    []interface{}    `json:"characters_wiki"`
	MoviesAndSpecials []interface{}    `json:"movies_and_specials"`
}

type SeriesSagas struct {
	SeriesID      string     `json:"series_id"`
	Title         string     `json:"title"`
	Years         string     `json:"years"`
	TotalEpisodes int        `json:"total_episodes"`
	TotalSagas    int        `json:"total_sagas"`
	Description   string     `json:"description"`
	Sagas         []SagaWiki `json:"sagas"`
}

type SagaWiki struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Episodes      string   `json:"episodes"`
	Canon         interface{} `json:"canon,omitempty"`
	IsFiller      bool     `json:"is_filler,omitempty"`
	Description   string   `json:"description"`
	Antagonists   []string `json:"antagonists,omitempty"`
	KeyEvents     []string `json:"key_events,omitempty"`
	NewCharacters []string `json:"new_characters,omitempty"`
}

type SagaRange struct {
	ID      string
	Title   string
	StartEp int
	EndEp   int
}

var (
	loreData *LoreWiki
	loreOnce sync.Once
)

// GetDragonBallLoreJSON returns the raw embedded JSON content.
func GetDragonBallLoreJSON() []byte {
	return dragonBallLoreJSON
}

// GetLore returns the loaded and parsed Dragon Ball lore wiki structure.
func GetLore() *LoreWiki {
	loreOnce.Do(func() {
		var l LoreWiki
		if err := json.Unmarshal(dragonBallLoreJSON, &l); err == nil {
			loreData = &l
		}
	})
	return loreData
}

// GetSeriesIDFromTMDB maps TMDB ID to the internal series ID.
func GetSeriesIDFromTMDB(tmdbID int) string {
	switch tmdbID {
	case 12609:
		return "dragon_ball"
	case 12971:
		return "dragon_ball_z"
	case 12697:
		return "dragon_ball_gt"
	case 62715:
		return "dragon_ball_super"
	case 236994:
		return "dragon_ball_daima"
	default:
		return ""
	}
}

// GetSagaRanges dynamically loads and returns the saga ranges for a given TMDB series.
func GetSagaRanges(tmdbID int) []SagaRange {
	seriesID := GetSeriesIDFromTMDB(tmdbID)
	if seriesID == "" {
		return nil
	}

	l := GetLore()
	if l == nil {
		return nil
	}

	for _, series := range l.SagasWiki {
		if series.SeriesID == seriesID {
			var ranges []SagaRange
			for _, s := range series.Sagas {
				start, end := parseEpRange(s.Episodes)
				ranges = append(ranges, SagaRange{
					ID:      s.ID,
					Title:   s.Name,
					StartEp: start,
					EndEp:   end,
				})
			}
			return ranges
		}
	}
	return nil
}


func parseEpRange(epRange string) (int, int) {
	parts := strings.Split(epRange, "-")
	if len(parts) == 0 {
		return 0, 0
	}
	start, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
	if len(parts) == 1 {
		return start, start
	}
	end, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
	return start, end
}
