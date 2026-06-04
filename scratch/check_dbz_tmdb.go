package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"
)

const (
	tmdbAPIKey   = "0584d4437be4d13174085bc9b4435985"
	tmdbBaseURL  = "https://api.themoviedb.org/3"
	dbzTMDBID    = 12971
)

type TVDetails struct {
	ID               int        `json:"id"`
	Name             string     `json:"name"`
	NumberOfSeasons  int        `json:"number_of_seasons"`
	NumberOfEpisodes int        `json:"number_of_episodes"`
	Seasons          []SeasonInfo `json:"seasons"`
}

type SeasonInfo struct {
	SeasonNumber int `json:"season_number"`
	EpisodeCount int `json:"episode_count"`
}

type TVSeason struct {
	Episodes []TVEpisode `json:"episodes"`
}

type TVEpisode struct {
	EpisodeNumber int    `json:"episode_number"`
	Name          string `json:"name"`
	AirDate       string `json:"air_date"`
	Overview      string `json:"overview"`
}

func fetchJSON(url string, v interface{}) error {
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return json.Unmarshal(body, v)
}

func main() {
	// 1. Get TV details
	tvURL := fmt.Sprintf("%s/tv/%d?api_key=%s", tmdbBaseURL, dbzTMDBID, tmdbAPIKey)
	var tvDetails TVDetails
	if err := fetchJSON(tvURL, &tvDetails); err != nil {
		log.Fatalf("Failed to get TV details: %v", err)
	}

	fmt.Printf("=== Dragon Ball Z (TMDB ID: %d) ===\n", dbzTMDBID)
	fmt.Printf("Title: %s\n", tvDetails.Name)
	fmt.Printf("Total Episodes: %d\n", tvDetails.NumberOfEpisodes)
	fmt.Printf("Total Seasons: %d\n", tvDetails.NumberOfSeasons)
	fmt.Println("\nSeason Breakdown:")
	for _, s := range tvDetails.Seasons {
		fmt.Printf("  Season %d: %d episodes\n", s.SeasonNumber, s.EpisodeCount)
	}

	// 2. Fetch all seasons and compute the flat map keys
	fmt.Println("\n=== Building Flat Episode Map ===")
	absCounter := 0
	seasonStartMap := make(map[int]int) // season -> first absolute ep number

	maxSeasons := (tvDetails.NumberOfEpisodes/12) + 2
	if maxSeasons > 20 {
		maxSeasons = 20
	}

	type EpInfo struct {
		Key           int
		SeasonNum     int
		SeasonEpNum   int
		Title         string
		ComputedAbsEp int // what EnrichWithSagas would compute
	}
	var allEps []EpInfo

	for seasonNum := 0; seasonNum <= maxSeasons; seasonNum++ {
		seasonURL := fmt.Sprintf("%s/tv/%d/season/%d?api_key=%s", tmdbBaseURL, dbzTMDBID, seasonNum, tmdbAPIKey)
		var season TVSeason
		if err := fetchJSON(seasonURL, &season); err != nil || len(season.Episodes) == 0 {
			if seasonNum > 1 {
				break
			}
			continue
		}

		if seasonNum == 0 {
			fmt.Printf("Season 0 (Specials): %d episodes\n", len(season.Episodes))
			continue
		}

		seasonStartMap[seasonNum] = absCounter + 1
		for _, ep := range season.Episodes {
			absCounter++
			// Compute what EnrichWithSagas would use for saga lookup
			computedAbsEp := ep.EpisodeNumber
			switch seasonNum {
			case 2:
				computedAbsEp += 39
			case 3:
				computedAbsEp += 74
			case 4:
				computedAbsEp += 107
			case 5:
				computedAbsEp += 139
			case 6:
				computedAbsEp += 165
			case 7:
				computedAbsEp += 194
			case 8:
				computedAbsEp += 219
			case 9:
				computedAbsEp += 253
			}
			allEps = append(allEps, EpInfo{
				Key:           absCounter,
				SeasonNum:     seasonNum,
				SeasonEpNum:   ep.EpisodeNumber,
				Title:         ep.Name,
				ComputedAbsEp: computedAbsEp,
			})
		}
		fmt.Printf("Season %d: %d episodes (abs %d-%d)\n", seasonNum, len(season.Episodes), seasonStartMap[seasonNum], absCounter)
	}

	fmt.Println("\n=== Saga Assignment Check ===")
	// Saga definitions
	type SagaRange struct {
		Id    string
		Title string
		Start int
		End   int
	}
	sagas := []SagaRange{
		{"saiyajin", "Saga Saiyajin", 1, 35},
		{"freezer", "Saga de Freezer", 36, 107},
		{"garlic-jr", "Saga de Garlic Jr.", 108, 117},
		{"androides", "Saga de los Androides", 118, 139},
		{"cell", "Saga de Cell", 140, 194},
		{"torneo-otro-mundo", "Saga del Torneo del Otro Mundo", 195, 199},
		{"gran-saiyaman", "Saga del Gran Saiyaman", 200, 209},
		{"majin-buu", "Saga de Majin Buu", 210, 291},
	}

	getSaga := func(absEp int) string {
		for _, s := range sagas {
			if absEp >= s.Start && absEp <= s.End {
				return s.Id
			}
		}
		return ""
	}

	// Count sagas assigned by Key vs computedAbsEp
	withSagaByKey := 0
	withSagaByComputed := 0
	mismatches := 0

	for _, ep := range allEps {
		sagaByKey := getSaga(ep.Key)
		sagaByComputed := getSaga(ep.ComputedAbsEp)

		if sagaByKey != "" {
			withSagaByKey++
		}
		if sagaByComputed != "" {
			withSagaByComputed++
		}
		if sagaByKey != sagaByComputed {
			mismatches++
		}
	}

	fmt.Printf("Total episodes: %d\n", len(allEps))
	fmt.Printf("Sagas assigned using KEY (flat abs counter): %d\n", withSagaByKey)
	fmt.Printf("Sagas assigned using ComputedAbsEp (per-season + offset): %d\n", withSagaByComputed)
	fmt.Printf("Mismatches: %d\n", mismatches)

	// Show episodes where key != computedAbsEp (season boundaries)
	fmt.Println("\nSeason boundary checks (where Key != ComputedAbsEp):")
	for _, ep := range allEps {
		if ep.Key != ep.ComputedAbsEp {
			saga := getSaga(ep.ComputedAbsEp)
			fmt.Printf("  Key=%d, S%d-E%d, computedAbs=%d, saga=%q, Title=%q\n",
				ep.Key, ep.SeasonNum, ep.SeasonEpNum, ep.ComputedAbsEp, saga, ep.Title)
		}
	}

	// Show episodes with no saga assigned (should all be 0)
	fmt.Println("\nEpisodes with no saga (using computed abs ep):")
	var noSagaKeys []int
	for _, ep := range allEps {
		if getSaga(ep.ComputedAbsEp) == "" {
			noSagaKeys = append(noSagaKeys, ep.Key)
		}
	}
	sort.Ints(noSagaKeys)
	fmt.Printf("Count: %d, Keys: %v\n", len(noSagaKeys), noSagaKeys)

	// Show what's around the season 1/2 boundary
	fmt.Println("\nEpisodes 33-42 (Season 1->2 boundary check):")
	for _, ep := range allEps {
		if ep.Key >= 33 && ep.Key <= 42 {
			fmt.Printf("  Key=%d | S%d-E%d | computedAbs=%d | saga=%q\n",
				ep.Key, ep.SeasonNum, ep.SeasonEpNum, ep.ComputedAbsEp, getSaga(ep.ComputedAbsEp))
		}
	}

	// Print unique map key -> season info for verification
	fmt.Println("\nFirst 5 and last 5 episodes:")
	for i, ep := range allEps {
		if i < 5 || i >= len(allEps)-5 {
			fmt.Printf("  Key=%d | S%d-E%d | absCounter(key)==computedAbs? %v | Title=%q\n",
				ep.Key, ep.SeasonNum, ep.SeasonEpNum, ep.Key == ep.ComputedAbsEp, ep.Title)
		}
	}

	_ = strconv.Itoa
}
