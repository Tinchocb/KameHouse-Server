package main

import (
	"context"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"os"
	"github.com/rs/zerolog"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	d, err := db.NewDatabase(context.Background(), "C:/Users/marti/AppData/Roaming/KameHouse", "kamehouse", &logger)
	if err != nil {
		fmt.Printf("Error opening DB: %v\n", err)
		os.Exit(1)
	}

	var movies []models.LibraryMedia
	err = d.Gorm().Where("type = ?", "MOVIE").Find(&movies).Error
	if err != nil {
		fmt.Printf("Error querying movies: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d movies in DB\n", len(movies))
	for _, m := range movies {
		fmt.Printf("ID: %d, TMDB ID: %d, Title: %s\n", m.ID, m.TmdbId, m.TitleRomaji)
	}
    
	var localFiles []models.LocalFile
	err = d.Gorm().Find(&localFiles).Error
	if err != nil {
		fmt.Printf("Error querying local files: %v\n", err)
	}

	movieFiles := 0
	for _, lf := range localFiles {
		if lf.MediaId != 0 {
			if lf.MediaId >= 1000000 {
				movieFiles++
			}
			// Only print a few
			if movieFiles < 10 {
				fmt.Printf("File: %s, MediaID: %d\n", lf.Path, lf.MediaId)
			}
		}
	}
	fmt.Printf("Total files with media ID >= 1M: %d\n", movieFiles)
	fmt.Printf("Total files in DB: %d\n", len(localFiles))
}
