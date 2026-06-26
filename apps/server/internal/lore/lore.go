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

// TMDB series IDs → internal series_id mapping
var tmdbToSeriesID = map[int]string{
	12609:  "dragon_ball",
	12971:  "dragon_ball_z",
	12697:  "dragon_ball_gt",
	62715:  "dragon_ball_super",
	236994: "dragon_ball_daima",
	80629:  "dragon_ball_heroes",
}

// GetSeriesIDFromTMDB maps a TMDB media ID to the internal Dragon Ball series_id string.
// Returns empty string if the TMDB ID is not recognized.
func GetSeriesIDFromTMDB(tmdbID int) string {
	return tmdbToSeriesID[tmdbID]
}

// GetTMDBIDs returns the full TMDB ID → series_id mapping.
func GetTMDBIDs() map[int]string {
	return tmdbToSeriesID
}

type LoreWiki struct {
	Universe          string        `json:"universe"`
	SagasWiki         []SeriesSagas `json:"sagas_wiki"`
	CharactersWiki    []interface{} `json:"characters_wiki"`
	MoviesAndSpecials []interface{} `json:"movies_and_specials"`
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
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Episodes      string      `json:"episodes"`
	Canon         interface{} `json:"canon,omitempty"`
	IsFiller      bool        `json:"is_filler,omitempty"`
	Description   string      `json:"description"`
	Antagonists   []string    `json:"antagonists,omitempty"`
	KeyEvents     []string    `json:"key_events,omitempty"`
	NewCharacters []string    `json:"new_characters,omitempty"`
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

// GetLore returns the parsed Dragon Ball lore wiki (lazily initialized).
func GetLore() *LoreWiki {
	loreOnce.Do(func() {
		var data struct {
			Universe          string        `json:"universe"`
			SagasWiki         []SeriesSagas `json:"sagas_wiki"`
			CharactersWiki    []interface{} `json:"characters_wiki"`
			MoviesAndSpecials []interface{} `json:"movies_and_specials"`
		}
		if err := json.Unmarshal(dragonBallLoreJSON, &data); err == nil {
			loreData = &LoreWiki{
				Universe:          data.Universe,
				SagasWiki:         data.SagasWiki,
				CharactersWiki:    data.CharactersWiki,
				MoviesAndSpecials: data.MoviesAndSpecials,
			}
		}
	})
	return loreData
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
				start, end := ParseEpRange(s.Episodes)
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

func ParseEpRange(epRange string) (int, int) {
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
