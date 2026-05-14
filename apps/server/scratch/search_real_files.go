package main

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	_ "github.com/glebarez/sqlite"
)

func main() {
	dbPath := `C:\Users\marti\AppData\Roaming\KameHouse\kamehouse.db`
	dsn := fmt.Sprintf("%s?_query_only=true&_busy_timeout=1000", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT path, media_id, library_media_id FROM local_files")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	found := 0
	for rows.Next() {
		var path string
		var mediaId int
		var libraryMediaId uint
		rows.Scan(&path, &mediaId, &libraryMediaId)
		if !strings.Contains(path, "FakePath") {
			fmt.Printf("Path: %s, MediaId: %d, LibraryMediaId: %d\n", path, mediaId, libraryMediaId)
			found++
		}
	}
	fmt.Printf("\nTotal non-fake files found: %d\n", found)
}
