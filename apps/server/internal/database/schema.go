package database

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

// InitDB initializes the schema with foreign keys, tables, and optimized indexes.
func InitDB(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	// Enable foreign key constraints for relationship integrity.
	if _, err := db.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		return nil, err
	}

	schema := `
	CREATE TABLE IF NOT EXISTS media (
		id UUID PRIMARY KEY,
		anilist_id INT,
		tmdb_id INT,
		imdb_id TEXT,
		type TEXT,
		title_romaji TEXT
	);

	CREATE TABLE IF NOT EXISTS episodes (
		id UUID PRIMARY KEY,
		media_id UUID,
		number INT,
		absolute_number INT,
		is_epic BOOL,
		is_filler BOOL,
		arc_name TEXT,
		FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS media_sources (
		id UUID PRIMARY KEY,
		episode_id UUID,
		source_type TEXT,
		quality TEXT,
		path_or_url TEXT,
		codec TEXT,
		is_primary BOOL,
		FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS user_progress (
		episode_id UUID PRIMARY KEY,
		watched_seconds INT,
		last_watched_at DATETIME,
		FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
	);

	-- Indexes for Dragon Ball Scale fast lookup operations
	CREATE INDEX IF NOT EXISTS idx_episodes_media_number ON episodes(media_id, number);
	CREATE INDEX IF NOT EXISTS idx_media_anilist ON media(anilist_id);
	CREATE INDEX IF NOT EXISTS idx_media_tmdb ON media(tmdb_id);
	CREATE INDEX IF NOT EXISTS idx_media_sources_episode ON media_sources(episode_id);
	`

	// Execute the full DDL transaction cleanly.
	if _, err := db.Exec(schema); err != nil {
		log.Printf("Failed to initialize schema: %v\n", err)
		return nil, err
	}

	return db, nil
}
