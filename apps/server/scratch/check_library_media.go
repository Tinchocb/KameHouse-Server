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

	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM library_media").Scan(&count)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Total library_media records: %d\n", count)

	rows, err := db.Query("SELECT id, tmdb_id, title_english, type FROM library_media LIMIT 10")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("\nFirst 10 records:")
	for rows.Next() {
		var id uint
		var tmdbId int
		var title string
		var mType string
		rows.Scan(&id, &tmdbId, &title, &mType)
		fmt.Printf("ID: %d, TMDB: %d, Title: %s, Type: %s\n", id, tmdbId, title, mType)
	}
}
