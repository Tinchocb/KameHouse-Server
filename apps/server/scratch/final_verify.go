package main

import (
	"context"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"os"
	"log"

	"github.com/rs/zerolog"
	_ "github.com/glebarez/sqlite"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Logger()
	d, err := db.NewDatabase(context.Background(), "", "", &logger)
	if err != nil {
		log.Fatal(err)
	}

	// Test with 31 media (what the user had) and batch size 10
	media := make([]*models.LibraryMedia, 31)
	for i := 0; i < 31; i++ {
		media[i] = &models.LibraryMedia{
			TmdbId: i + 1,
			TitleEnglish: fmt.Sprintf("Media %d", i),
		}
	}

	// This should succeed now as it will run 4 batches of 10
	err = db.UpsertLibraryMediaBatch(d, media, 10)
	if err != nil {
		fmt.Printf("FAILED with 31 media and batch 10: %v\n", err)
	} else {
		fmt.Printf("SUCCESS with 31 media and batch 10\n")
	}
}
