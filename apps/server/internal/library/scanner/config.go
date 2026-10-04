package scanner

import (
	"encoding/json"
	"kamehouse/internal/database/models/dto"
)

func ToConfig(c string) (*Config, error) {
	var ret Config
	if err := json.Unmarshal([]byte(c), &ret); err != nil {
		return nil, err
	}
	return &ret, nil
}

type Config struct {
	Matching  MatchingConfig  `json:"matching"`
	Hydration HydrationConfig `json:"hydration"`
	Logs      LogsConfig      `json:"logs"`
	//Ignore    []string        `json:"ignore"`
}

type LogsConfig struct {
	Verbose bool `json:"verbose"`
}

type MatchingConfig struct {
	StrictStructure bool `json:"strictStructure"`
}

type HydrationConfig struct {
	Rules []*HydrationRule `json:"rules"`
}

// HydrationRule defines a rule for attaching metadata to local files.
//
//	Example:
//		"hydration": [{
//			"mediaID": 12345,
//			"files": [
//				{
//					"pattern": "Mob Psycho - (\d+) - (.*)$",
//					"episode": "calc($1-12)",
//					"aniDbEpisode": "$1",
//					"type": "main",
//				},
//				{
//					"pattern": "Mob Psycho - NCOP(\d+)$",
//					"episode": "$1",
//					"aniDbEpisode": "$1",
//					"type": "nc",
//				}
//			]
//		}]
type HydrationRule struct {
	// Regex pattern for the path
	Pattern string `json:"pattern"`
	// The Media ID
	MediaID int `json:"mediaId"`
	// Files represents a collection of files associated with a specific hydration rule.
	Files []*HydrationFileRule `json:"files"`
}

type HydrationFileRule struct {
	Filename     string            `json:"filename"`
	IsRegex      bool              `json:"isRegex"`
	Episode      string            `json:"episode"`
	AniDbEpisode string            `json:"aniDbEpisode"`
	Type         dto.LocalFileType `json:"type,omitempty"`
}
