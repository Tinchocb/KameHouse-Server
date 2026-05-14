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

	rows, err := db.Query("SELECT path, media_id FROM local_files WHERE path LIKE 'D:\\KameHouseMedia%'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Matched files in D:\\KameHouseMedia:")
	for rows.Next() {
		var path string
		var mediaId int
		rows.Scan(&path, &mediaId)
		fmt.Printf("Path: %s, MediaId: %d\n", path, mediaId)
	}
}
