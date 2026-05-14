package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/rs/zerolog"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
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
		lf := dto.NewLocalFileS(f, libraryPaths)
		// Manually set some fields to test persistence
		lf.MediaId = 12971 // Dragon Ball Z
		lfs = append(lfs, lf)
	}

	// 3. Persist them using SyncLocalFilesRelational
	fmt.Println("Syncing files...")
	err = db.SyncLocalFilesRelational(database, lfs)
	if err != nil {
		fmt.Printf("SYNC FAILED: %v\n", err)
	} else {
		fmt.Println("Sync successful!")
	}

	// 4. Check count in DB
	var count int
	database.Gorm().Raw("SELECT COUNT(*) FROM local_files").Scan(&count)
	fmt.Printf("Total files in DB after sync: %d\n", count)
	
	var fakeCount int
	database.Gorm().Raw("SELECT COUNT(*) FROM local_files WHERE path LIKE '%FakePath%'").Scan(&fakeCount)
	fmt.Printf("Fake files in DB after sync: %d\n", fakeCount)
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
