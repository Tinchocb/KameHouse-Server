package metadata_provider

import (
	"embed"
	"encoding/json"
	apiMetadata "kamehouse/internal/api/metadata"
)

//go:embed latin_overrides.json
var resources embed.FS

var dragonBallLatinTitles map[int]map[string]string

func init() {
	dragonBallLatinTitles = make(map[int]map[string]string)
	data, err := resources.ReadFile("latin_overrides.json")
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, &dragonBallLatinTitles)
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
		if title, ok := GetLatinTitle(tmdbID, ep.Episode); ok {
			ep.Title = title
		}
	}
}
