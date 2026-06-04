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

	rows, err := db.Query(`
		SELECT season_number, saga_id, COUNT(*) 
		FROM library_episodes 
		WHERE library_media_id = 7 
		GROUP BY season_number, saga_id
		ORDER BY season_number
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("DBZ episodes in DB by season and saga_id after repair:")
	for rows.Next() {
		var season int
		var sagaId string
		var count int
		if err := rows.Scan(&season, &sagaId, &count); err == nil {
			fmt.Printf("  Season %d | SagaId: %q | Count: %d\n", season, sagaId, count)
		}
	}
}
