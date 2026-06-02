package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/glebarez/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Query Settings
	var seriesPaths, moviePaths, provider, apiKey, opensubsKey string
	err = db.QueryRow("SELECT library_series_paths, library_movie_paths, library_primary_metadata_provider, library_tmdb_api_key, library_opensubs_api_key FROM settings LIMIT 1").
		Scan(&seriesPaths, &moviePaths, &provider, &apiKey, &opensubsKey)
	if err != nil {
		fmt.Printf("Error querying settings: %v\n", err)
	} else {
		maskedKey := "EMPTY"
		if len(apiKey) > 4 {
			maskedKey = apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
		}
		maskOpenSubs := "EMPTY"
		if len(opensubsKey) > 4 {
			maskOpenSubs = opensubsKey[:4] + "..." + opensubsKey[len(opensubsKey)-4:]
		}
		fmt.Printf("Settings:\n - SeriesPaths: %q\n - MoviePaths: %q\n - Provider: %q\n - TMDB Key: %q\n - OpenSubs Key: %q\n",
			seriesPaths, moviePaths, provider, maskedKey, maskOpenSubs)
	}

	// Query library_episode counts
	fmt.Println("\n--- Library Episodes and Saga ID status (Before Fix) ---")
	rowsEp, err := db.Query(`
		SELECT m.id, m.title_english, m.title_original, 
		       COUNT(e.id) as total,
		       SUM(CASE WHEN e.saga_id IS NULL OR e.saga_id = '' THEN 1 ELSE 0 END) as empty_saga
		FROM library_media m
		LEFT JOIN library_episodes e ON m.id = e.library_media_id
		WHERE m.type = 'SHOW' AND (m.title_english LIKE '%Dragon%' OR m.title_original LIKE '%Dragon%')
		GROUP BY m.id
	`)
	if err != nil {
		log.Fatalf("Error querying episodes: %v", err)
	}
	for rowsEp.Next() {
		var id, total, empty int
		var titleEng, titleOrg string
		if err := rowsEp.Scan(&id, &titleEng, &titleOrg, &total, &empty); err == nil {
			title := titleEng
			if title == "" {
				title = titleOrg
			}
			fmt.Printf("Show ID: %d | Title: %q | Total Eps: %d | Eps with Empty SagaId: %d\n", id, title, total, empty)
		}
	}
	rowsEp.Close()

	// Define saga mappings
	type sagaDef struct {
		id      string
		name    string
		startEp int
		endEp   int
	}

	sagaDefinitions := map[int][]sagaDef{
		12609: {
			{"pilaf", "Saga de Pilaf", 1, 13},
			{"torneo-21", "21º Torneo de Artes Marciales", 14, 28},
			{"red-ribbon", "Saga de la Patrulla Roja", 29, 68},
			{"uranai-baba", "Saga de la Abuela Baba", 69, 82},
			{"torneo-22", "22º Torneo de Artes Marciales", 83, 101},
			{"piccolo", "Saga de Piccolo Daimaoh", 102, 122},
			{"piccolo-jr", "Saga de Piccolo Jr.", 123, 153},
		},
		12971: {
			{"saiyajin", "Saga de los Saiyajin", 1, 35},
			{"freezer", "Saga de Freezer", 36, 107},
			{"garlic-jr", "Saga de Garlic Jr.", 108, 117},
			{"androides", "Saga de los Androides", 118, 139},
			{"cell", "Saga de Cell", 140, 194},
			{"torneo-otro-mundo", "Torneo del Otro Mundo", 195, 199},
			{"majin-buu", "Saga de Majin Buu", 200, 291},
		},
		12697: {
			{"black-star", "Saga de las Esferas del Dragón Definitivas", 1, 16},
			{"baby", "Saga de Baby", 17, 40},
			{"super-17", "Saga de Super-17", 41, 47},
			{"shadow-dragons", "Saga de los Dragones Malignos", 48, 64},
		},
		62715: {
			{"batalla-dioses", "Saga de la Batalla de los Dioses", 1, 14},
			{"resurreccion-f", "Saga de la Resurrección de 'F'", 15, 27},
			{"universo-6", "Saga del Torneo del Universo 6 (Champa)", 28, 46},
			{"trunks-futuro", "Saga de Trunks del Futuro (Goku Black)", 47, 76},
			{"supervivencia-universal", "Saga del Supervivencia Universal (Torneo del Poder)", 77, 131},
		},
		61709: {
			{"saiyajin", "Saga Saiyajin", 1, 18},
			{"freezer", "Saga de Freezer", 19, 54},
			{"cell", "Saga de Cell", 55, 98},
			{"majin_buu", "Saga de Majin Buu", 99, 167},
		},
		236994: {
			{"daima-misterio", "El Misterio del Mundo Demonio", 1, 10},
			{"daima-travesia", "La Travesía en el Mundo Demonio", 11, 20},
		},
	}

	// Update episodes in database
	fmt.Println("\n--- Running Saga ID Database Repair ---")
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("Failed to begin transaction: %v", err)
	}

	rowsToFix, err := tx.Query(`
		SELECT e.id, m.tmdb_id, e.episode_number 
		FROM library_episodes e
		JOIN library_media m ON m.id = e.library_media_id
		WHERE e.saga_id IS NULL OR e.saga_id = ''
	`)
	if err != nil {
		tx.Rollback()
		log.Fatalf("Failed to query episodes to fix: %v", err)
	}

	type updateItem struct {
		id   int
		sID  string
		sName string
	}
	var toUpdate []updateItem

	for rowsToFix.Next() {
		var id, tmdbID, epNum int
		if err := rowsToFix.Scan(&id, &tmdbID, &epNum); err == nil {
			if defs, ok := sagaDefinitions[tmdbID]; ok {
				for _, d := range defs {
					if epNum >= d.startEp && epNum <= d.endEp {
						toUpdate = append(toUpdate, updateItem{id: id, sID: d.id, sName: d.name})
						break
					}
				}
			}
		}
	}
	rowsToFix.Close()

	updatedCount := 0
	for _, item := range toUpdate {
		_, err := tx.Exec("UPDATE library_episodes SET saga_id = ?, saga_name = ? WHERE id = ?", item.sID, item.sName, item.id)
		if err == nil {
			updatedCount++
		}
	}

	if err := tx.Commit(); err != nil {
		log.Fatalf("Failed to commit transaction: %v", err)
	}
	fmt.Printf("Successfully updated %d library_episode database records with correct Saga IDs.\n", updatedCount)

	// Query library_episode counts after fix
	fmt.Println("\n--- Library Episodes and Saga ID status (After Fix) ---")
	rowsEp2, err := db.Query(`
		SELECT m.id, m.title_english, m.title_original, 
		       COUNT(e.id) as total,
		       SUM(CASE WHEN e.saga_id IS NULL OR e.saga_id = '' THEN 1 ELSE 0 END) as empty_saga
		FROM library_media m
		LEFT JOIN library_episodes e ON m.id = e.library_media_id
		WHERE m.type = 'SHOW' AND (m.title_english LIKE '%Dragon%' OR m.title_original LIKE '%Dragon%')
		GROUP BY m.id
	`)
	if err == nil {
		defer rowsEp2.Close()
		for rowsEp2.Next() {
			var id, total, empty int
			var titleEng, titleOrg string
			if err := rowsEp2.Scan(&id, &titleEng, &titleOrg, &total, &empty); err == nil {
				title := titleEng
				if title == "" {
					title = titleOrg
				}
				fmt.Printf("Show ID: %d | Title: %q | Total Eps: %d | Eps with Empty SagaId: %d\n", id, title, total, empty)
			}
		}
	}

	// Query local files count
	fmt.Println("\n--- Local Files ---")
	var fileCount int
	db.QueryRow("SELECT COUNT(*) FROM local_file").Scan(&fileCount)
	fmt.Printf("Total Local Files in DB: %d\n", fileCount)

	// Load all files from the local_file table into a map for fast lookup
	dbFiles := make(map[string]bool)
	rowsLF, err := db.Query("SELECT path FROM local_file")
	if err == nil {
		defer rowsLF.Close()
		for rowsLF.Next() {
			var p string
			if err := rowsLF.Scan(&p); err == nil {
				// Normalize path slashes/casing for comparison
				dbFiles[filepath.Clean(p)] = true
			}
		}
	}

	// Walk disk path to find files not in database
	fmt.Println("\n--- Files on Disk not in DB ---")
	diskCount := 0
	notInDBCount := 0
	err = filepath.Walk("D:\\KameHouseMedia\\COLECCION_DB\\Series", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".mkv" || ext == ".mp4" || ext == ".avi" || ext == ".m4v" {
			diskCount++
			cleanP := filepath.Clean(path)
			if !dbFiles[cleanP] {
				notInDBCount++
				if notInDBCount <= 30 {
					fmt.Printf("Not in DB: %s\n", path)
				}
			}
		}
		return nil
	})
	if err != nil {
		fmt.Printf("Error walking directory: %v\n", err)
	}
	fmt.Printf("Total video files on disk: %d\n", diskCount)
	fmt.Printf("Total video files missing from DB: %d\n", notInDBCount)


	// Let's check some local files mapped to ID 4 (Dragon Ball) or 7 (Dragon Ball Z) to see their details
	fmt.Println("\n--- Sample Local Files Mapping details for Dragon Ball (ID 4) ---")
	rowsSamp, err := db.Query(`
		SELECT path, media_id, library_media_id FROM local_file 
		WHERE library_media_id = 4 LIMIT 5
	`)
	if err == nil {
		defer rowsSamp.Close()
		for rowsSamp.Next() {
			var path string
			var mediaID, libMediaID int
			if err := rowsSamp.Scan(&path, &mediaID, &libMediaID); err == nil {
				fmt.Printf("Path: %q | MediaID: %d | LibMediaID: %d\n", path, mediaID, libMediaID)
			}
		}
	}
}



