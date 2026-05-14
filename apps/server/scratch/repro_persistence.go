package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/util"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	ctx := context.Background()

	appDataDir := `C:\Users\marti\AppData\Roaming\KameHouse`
	dbName := "kamehouse"

	// Initialize database
	database, err := db.NewDatabase(ctx, appDataDir, dbName, &logger)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Define target path
	targetPath := `D:\KameHouseMedia\COLECCION_DB\Series\Dragon Ball Z\Season 01`
	
	// 1. Discover files
	files, err := getMediaFiles(targetPath)
	if err != nil {
		log.Fatalf("Failed to discover files: %v", err)
	}
	fmt.Printf("Discovered %d files\n", len(files))

	// 2. Create LocalFile DTOs
	libraryPaths := []string{`D:\KameHouseMedia\COLECCION_DB\Series`}
	lfs := make([]*dto.LocalFile, 0, len(files))
	for _, f := range files {
		lfs = append(lfs, dto.NewLocalFileS(f, libraryPaths))
	}

	// 3. Match them (minimal matcher)
	// We need a matcher to hydrate them
	scn := &scanner.Scanner{
		Database: database,
		Logger:   &logger,
	}
	
	// Create a matcher
	m := scanner.NewMatcher(scanner.MatcherOptions{
		Database: database,
		Logger:   &logger,
	})

	fmt.Println("Matching files...")
	m.MatchLocalFilesWithMedia(lfs)

	// 4. Persist them
	fmt.Println("Persisting files...")
	err = db.UpsertLocalFileRelationalBatch(database, lfs)
	if err != nil {
		log.Fatalf("Failed to persist files: %v", err)
	}

	fmt.Println("Done! Check the database now.")
}

func getMediaFiles(dir string) ([]string, error) {
	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && util.IsValidVideoExtension(filepath.Ext(path)) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}
