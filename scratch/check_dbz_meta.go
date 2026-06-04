package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"

	_ "github.com/glebarez/go-sqlite"
)

type EpisodeMetadata struct {
	EpisodeNumber         int    `json:"episodeNumber"`
	SeasonNumber          int    `json:"seasonNumber"`
	Episode               string `json:"episode"`
	Title                 string `json:"title"`
	AbsoluteEpisodeNumber int    `json:"absoluteEpisodeNumber"`
	SagaId                string `json:"sagaId,omitempty"`
	SagaName              string `json:"sagaName,omitempty"`
	IsFiller              bool   `json:"isFiller,omitempty"`
}

type AnimeMetadata struct {
	Titles       map[string]string           `json:"titles"`
	Episodes     map[string]*EpisodeMetadata `json:"episodes"`
	EpisodeCount int                         `json:"episodeCount"`
}

func main() {
	db, err := sql.Open("sqlite", "C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Get all cached providers
	rows, err := db.Query(`SELECT provider, key, data FROM metadata_caches`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var provider, key, data string
		if err := rows.Scan(&provider, &key, &data); err != nil {
			log.Fatal(err)
		}

		fmt.Printf("\n=== Provider: %s, Key: %s ===\n", provider, key)

		var meta AnimeMetadata
		if err := json.Unmarshal([]byte(data), &meta); err != nil {
			fmt.Printf("ERROR decoding: %v\n", err)
			continue
		}

		fmt.Printf("Titles: %v\n", meta.Titles)
		fmt.Printf("EpisodeCount: %d, Total keys: %d\n", meta.EpisodeCount, len(meta.Episodes))

		// Sort keys for display
		var keys []int
		var specialKeys []string
		for k := range meta.Episodes {
			if n, err := strconv.Atoi(k); err == nil {
				keys = append(keys, n)
			} else {
				specialKeys = append(specialKeys, k)
			}
		}
		sort.Ints(keys)

		// Show first 10 and specific episodes
		fmt.Println("\nFirst 5 main episodes:")
		for _, k := range keys[:min(5, len(keys))] {
			ep := meta.Episodes[strconv.Itoa(k)]
			fmt.Printf("  Key=%d | EpNum=%d | Season=%d | AbsEp=%d | SagaId=%q | SagaName=%q | Filler=%v | Title=%q\n",
				k, ep.EpisodeNumber, ep.SeasonNumber, ep.AbsoluteEpisodeNumber, ep.SagaId, ep.SagaName, ep.IsFiller, ep.Title)
		}

		// Show last 5
		if len(keys) > 5 {
			fmt.Println("\nLast 5 main episodes:")
			for _, k := range keys[len(keys)-5:] {
				ep := meta.Episodes[strconv.Itoa(k)]
				fmt.Printf("  Key=%d | EpNum=%d | Season=%d | AbsEp=%d | SagaId=%q | SagaName=%q | Filler=%v | Title=%q\n",
					k, ep.EpisodeNumber, ep.SeasonNumber, ep.AbsoluteEpisodeNumber, ep.SagaId, ep.SagaName, ep.IsFiller, ep.Title)
			}
		}

		// Check episodes around Freezer saga (36-107)
		if len(keys) > 36 {
			fmt.Println("\nEpisodes 35-40 (Freezer saga transition):")
			for _, k := range []int{35, 36, 37, 38, 39, 40} {
				ep, ok := meta.Episodes[strconv.Itoa(k)]
				if !ok {
					fmt.Printf("  Key=%d: NOT FOUND\n", k)
					continue
				}
				fmt.Printf("  Key=%d | EpNum=%d | Season=%d | AbsEp=%d | SagaId=%q | SagaName=%q | Filler=%v\n",
					k, ep.EpisodeNumber, ep.SeasonNumber, ep.AbsoluteEpisodeNumber, ep.SagaId, ep.SagaName, ep.IsFiller)
			}
		}

		// Count episodes with saga
		withSaga := 0
		for _, ep := range meta.Episodes {
			if ep.SagaId != "" {
				withSaga++
			}
		}
		fmt.Printf("\nEpisodes with saga assigned: %d / %d\n", withSaga, len(meta.Episodes))

		if len(specialKeys) > 0 {
			fmt.Printf("Special keys (%d): %v\n", len(specialKeys), specialKeys[:min(5, len(specialKeys))])
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
