package main

import (
	"context"
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util"
)

func main() {
	// Initialize logger
	logger := util.NewLogger()

	// 1. Connect to DB
	gdb, err := gorm.Open(sqlite.Open("C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	// We need a db.Database wrapper
	// Get settings for API key
	var settings models.Settings
	if err := gdb.First(&settings).Error; err != nil {
		log.Fatalf("failed to get settings: %v", err)
	}

	apiKey := settings.Library.TmdbApiKey
	fmt.Printf("TMDB API Key length: %d\n", len(apiKey))

	// 2. Initialize TMDB Client
	client := tmdb.NewClient(apiKey, "es-MX")

	// Test directly calling TMDB
	ctx := context.Background()
	tvDetails, err := client.GetTVDetails(ctx, "12609")
	if err != nil {
		fmt.Printf("Direct TMDB GetTVDetails failed: %v\n", err)
	} else {
		fmt.Printf("Direct TMDB success: Name=%q, NumberOfEpisodes=%d, NumberOfSeasons=%d\n",
			tvDetails.Name, tvDetails.NumberOfEpisodes, tvDetails.NumberOfSeasons)
	}

	// 3. Let's run metadata provider impl
	provider := metadata_provider.NewTMDBProviderImpl(client, nil, logger)
	meta, err := provider.GetAnimeMetadata(12609)
	if err != nil {
		fmt.Printf("Provider GetAnimeMetadata failed: %v\n", err)
	} else {
		fmt.Printf("Provider success: TitleCount=%d, EpisodeCount=%d, SpecialCount=%d\n",
			len(meta.Titles), meta.EpisodeCount, meta.SpecialCount)
	}
}
