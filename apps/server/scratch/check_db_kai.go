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

	rows, err := db.Query("SELECT path FROM local_files WHERE library_media_id = 1028")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Path: [%s]\n", path)
		count++
	}
	fmt.Printf("Total files for DB Kai: %d\n", count)
}
