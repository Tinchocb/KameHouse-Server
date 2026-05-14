package main

import (
	"database/sql"
	"fmt"
	"log"

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

	rows, err := db.Query("SELECT path, media_id FROM local_files")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var path string
		var mediaId int
		rows.Scan(&path, &mediaId)
		if len(path) > 2 && path[:2] == "D:" && !contains(path, "FakePath") {
			fmt.Printf("Path: %s, MediaId: %d\n", path, mediaId)
		}
	}
}

func contains(s, substr string) bool {
	return (len(s) >= len(substr)) && (s[0:len(substr)] == substr || contains(s[1:], substr))
}
