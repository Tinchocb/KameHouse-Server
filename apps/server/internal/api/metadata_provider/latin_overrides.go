package metadata_provider

import (
	"embed"
	"encoding/json"
	"strconv"
	apiMetadata "kamehouse/internal/api/metadata"
)

//go:embed latin_overrides.json
var resources embed.FS

var dragonBallLatinTitles map[int]map[string]string

func init() {
	data, err := resources.ReadFile("latin_overrides.json")
	if err != nil {
		panic("failed to read latin_overrides.json: " + err.Error())
	}
	if err := json.Unmarshal(data, &dragonBallLatinTitles); err != nil {
		panic("failed to unmarshal latin_overrides.json: " + err.Error())
	}
}

// GetLatinTitle returns the Latin Spanish title for a Dragon Ball episode if available.
func GetLatinTitle(tmdbID int, episode string) (string, bool) {
	if titles, ok := dragonBallLatinTitles[tmdbID]; ok {
		if title, ok := titles[episode]; ok {
			return title, true
		}
	}
	return "", false
}

// EnrichWithLatinTitles overrides the episode metadata with Latin Spanish titles if available.
func EnrichWithLatinTitles(tmdbID int, metadata *apiMetadata.AnimeMetadata) {
	if metadata == nil || metadata.Episodes == nil {
		return
	}
	for _, ep := range metadata.Episodes {
		epNumStr := ep.Episode
		if tmdbID == 61709 && ep.SeasonNumber == 2 {
			epNumStr = strconv.Itoa(ep.EpisodeNumber + 98)
		}
		if title, ok := GetLatinTitle(tmdbID, epNumStr); ok {
			ep.Title = title
		}
	}
}
