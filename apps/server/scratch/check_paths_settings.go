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

	var seriesPaths, moviePaths string
	err = db.QueryRow("SELECT library_series_paths, library_movie_paths FROM settings LIMIT 1").Scan(&seriesPaths, &moviePaths)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Series Paths: %s\n", seriesPaths)
	fmt.Printf("Movie Paths: %s\n", moviePaths)
}
