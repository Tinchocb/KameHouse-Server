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

	media := make([]*models.LibraryMedia, 100)
	for i := 0; i < 100; i++ {
		media[i] = &models.LibraryMedia{
			TmdbId: i + 1,
			TitleEnglish: fmt.Sprintf("Media %d", i),
		}
	}

	err = db.UpsertLibraryMediaBatch(d, media, 100)
	if err != nil {
		fmt.Printf("FAILED with 100 media: %v\n", err)
	} else {
		fmt.Printf("SUCCESS with 100 media\n")
	}
}
