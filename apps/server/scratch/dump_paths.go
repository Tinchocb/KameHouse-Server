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

	count := 0
	for rows.Next() {
		var path string
		var mediaId int
		rows.Scan(&path, &mediaId)
		fmt.Printf("[%d] Path: %s, MediaId: %d\n", count, path, mediaId)
		count++
		if count >= 200 {
			break
		}
	}
}
