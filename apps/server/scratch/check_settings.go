package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/rs/zerolog"

	"kamehouse/internal/database/db"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	ctx := context.Background()

	appDataDir := `C:\Users\marti\AppData\Roaming\KameHouse`
	dbName := "kamehouse"

	database, err := db.NewDatabase(ctx, appDataDir, dbName, &logger)
	if err != nil {
		log.Fatal(err)
	}

	settings, err := database.GetSettings()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Scanner Provider: %s\n", settings.Library.ScannerProvider)
	fmt.Printf("Matching Threshold: %f\n", settings.Library.ScannerMatchingThreshold)
	fmt.Printf("Matching Algorithm: %s\n", settings.Library.ScannerMatchingAlgorithm)
	fmt.Printf("Use Legacy Matching: %v\n", settings.Library.ScannerUseLegacyMatching)
}
