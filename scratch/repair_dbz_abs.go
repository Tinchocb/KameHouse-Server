package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/glebarez/go-sqlite"
)

type Episode struct {
	ID            int
	SeasonNumber  int
	EpisodeNumber int
}

func main() {
	db, err := sql.Open("sqlite", "C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, season_number, episode_number FROM library_episodes WHERE library_media_id = 7")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	var eps []Episode
	for rows.Next() {
		var ep Episode
		if err := rows.Scan(&ep.ID, &ep.SeasonNumber, &ep.EpisodeNumber); err == nil {
			eps = append(eps, ep)
		}
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()

	updated := 0
	for _, ep := range eps {
		if ep.SeasonNumber == 0 {
			// Specials, keep absolute number as 0 or 999
			continue
		}

		absEp := ep.EpisodeNumber
		switch ep.SeasonNumber {
		case 2:
			absEp += 39
		case 3:
			absEp += 74
		case 4:
			absEp += 107
		case 5:
			absEp += 139
		case 6:
			absEp += 165
		case 7:
			absEp += 194
		case 8:
			absEp += 219
		case 9:
			absEp += 253
		}

		// Determine correct saga_id and saga_name
		sagaID := ""
		sagaName := ""
		switch {
		case absEp >= 1 && absEp <= 35:
			sagaID = "saiyajin"
			sagaName = "Saga Saiyajin"
		case absEp >= 36 && absEp <= 107:
			sagaID = "freezer"
			sagaName = "Saga de Freezer"
		case absEp >= 108 && absEp <= 117:
			sagaID = "garlic-jr"
			sagaName = "Saga de Garlic Jr."
		case absEp >= 118 && absEp <= 139:
			sagaID = "androides"
			sagaName = "Saga de los Androides"
		case absEp >= 140 && absEp <= 194:
			sagaID = "cell"
			sagaName = "Saga de Cell"
		case absEp >= 195 && absEp <= 199:
			sagaID = "torneo-otro-mundo"
			sagaName = "Saga del Torneo del Otro Mundo"
		case absEp >= 200 && absEp <= 209:
			sagaID = "gran-saiyaman"
			sagaName = "Saga del Gran Saiyaman"
		case absEp >= 210 && absEp <= 291:
			sagaID = "majin-buu"
			sagaName = "Saga de Majin Buu"
		}

		_, err := tx.Exec("UPDATE library_episodes SET absolute_number = ?, saga_id = ?, saga_name = ? WHERE id = ?", absEp, sagaID, sagaName, ep.ID)
		if err != nil {
			log.Fatalf("Failed to update episode ID %d: %v", ep.ID, err)
		}
		updated++
	}

	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Successfully repaired %d DBZ episodes in the database.\n", updated)
}
