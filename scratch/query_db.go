package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/glebarez/go-sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Print first 5 episodes of Season 1
	rows, err := db.Query("SELECT episode_number, absolute_number, title, image FROM library_episodes WHERE library_media_id = 7 AND season_number = 1 ORDER BY episode_number LIMIT 5")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Season 1 first 5 episodes:")
	for rows.Next() {
		var epNum, absNum int
		var title, image string
		if err := rows.Scan(&epNum, &absNum, &title, &image); err == nil {
			fmt.Printf("  Ep %d (abs %d) | Title: %q | Image: %q\n", epNum, absNum, title, image)
		}
	}
}
