package main

import (
	"fmt"
	"kamehouse/internal/database/db"
	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	dbPath := os.ExpandEnv("${APPDATA}/KameHouse/kamehouse.db")
	fmt.Printf("Opening database: %s\n", dbPath)
	database, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	d := &db.Database{}
	// Reflect inject
	d.Init(database, nil)

	files, id, err := db.GetLocalFiles(d)
	if err != nil {
		panic(err)
	}

	count := 0
	for _, lf := range files {
		// If it has a MediaId but LibraryMediaId is 0, it means it's unlinked from the database.
		// It could be an old AniList ID.
		if lf.MediaId > 0 && lf.LibraryMediaId == 0 {
			fmt.Printf("Resetting unlinked file: %s (was MediaId %d)\n", lf.Name, lf.MediaId)
			lf.MediaId = 0
			lf.ParsedInfo = nil
			lf.ParsedFolderInfo = nil
			count++
		}
	}

	if count > 0 {
		_, err = db.SaveLocalFiles(d, id, files)
		if err != nil {
			panic(err)
		}
		fmt.Printf("Successfully reset %d files!\n", count)
	} else {
		fmt.Println("No unlinked files found.")
	}

	fmt.Println("Done! Please click 'Scan' in the KameHouse settings to rematch them with TMDB.")
}
