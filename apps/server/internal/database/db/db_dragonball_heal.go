package db

import (
	"encoding/json"
	"strconv"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
)

// seedDragonBallMalIds corrige de forma autoritativa el myanimelist_id para las 5 series
// Dragon Ball usando el mapeo TMDB→MAL hardcodeado. Es idempotente: solo actualiza filas
// cuyo myanimelist_id no coincida con el valor correcto.
func seedDragonBallMalIds(gormDB *gorm.DB, logger *zerolog.Logger) {
	// Mapa TMDB ID → MAL ID. Coextensivo con dragonBallArcs en
	// internal/library/anime/intelligence.go.
	dragonBallMap := map[int]int{
		12609:  223,   // Dragon Ball
		12971:  813,   // Dragon Ball Z
		12697:  225,   // Dragon Ball GT
		61709:  6033,  // Dragon Ball Kai
		42705:  6033,  // Dragon Ball Kai
		62715:  30694, // Dragon Ball Super
		236994: 56894, // Dragon Ball Daima
	}
	total := int64(0)
	for tmdbID, malID := range dragonBallMap {
		result := gormDB.Exec(
			"UPDATE library_media SET myanimelist_id = ? WHERE tmdb_id = ? AND myanimelist_id <> ?",
			malID, tmdbID, malID,
		)
		if result.Error != nil {
			logger.Error().Err(result.Error).
				Int("tmdbID", tmdbID).Int("malID", malID).
				Msg("db: fallo al sembrar MAL ID para Dragon Ball")
		} else if result.RowsAffected > 0 {
			logger.Info().
				Int("tmdbID", tmdbID).Int("malID", malID).Int64("rows", result.RowsAffected).
				Msg("db: MAL ID de Dragon Ball corregido")
			total += result.RowsAffected
		}
	}
	if total > 0 {
		logger.Info().Int64("total", total).Msg("db: MAL IDs Dragon Ball sembrados correctamente")
	}
}

// healDragonBallKai repara automáticamente en la base de datos el conteo de episodios
// de Dragon Ball Kai (167 canónicos) y restaura como episodios regulares (tipo main)
// cualquier archivo de Kai que hubiera sido erróneamente clasificado como 'special'.
func healDragonBallKai(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_kai_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	// Si algún paso falla no se marca la migración, para reintentarla al próximo arranque.
	failed := false

	// 1. Asegurar 167 episodios en library_media para Dragon Ball Kai
	resMedia := d.gormdb.Exec("UPDATE library_media SET total_episodes = 167 WHERE tmdb_id IN (61709, 42705) AND (total_episodes IS NULL OR total_episodes < 167)")
	if resMedia.Error != nil {
		failed = true
		logger.Warn().Err(resMedia.Error).Msg("db: error actualizando total_episodes de Dragon Ball Kai")
	} else if resMedia.RowsAffected > 0 {
		logger.Info().Int64("rows", resMedia.RowsAffected).Msg("db: total_episodes de Dragon Ball Kai actualizado a 167")
	}

	// 2. Corregir cualquier local_file de Kai que haya sido clasificado erróneamente como 'special'
	// Bulk fetch + batch update instead of per-row Update()
	var kaiFiles []*models.LocalFile
	if err := d.gormdb.Where("media_id IN (61709, 42705)").Find(&kaiFiles).Error; err != nil {
		failed = true
		logger.Warn().Err(err).Msg("db: error leyendo archivos de Dragon Ball Kai")
	} else {
		type fixItem struct {
			id      uint
			meta    []byte
			path    string
			episode int
		}
		var fixes []fixItem
		for _, f := range kaiFiles {
			if len(f.Metadata) == 0 {
				continue
			}
			var meta dto.LocalFileMetadata
			if err := json.Unmarshal(f.Metadata, &meta); err == nil {
				if meta.Type == dto.LocalFileTypeSpecial {
					meta.Type = dto.LocalFileTypeMain
					if len(f.ParsedData) > 0 {
						var parsed dto.LocalFileParsedData
						if err := json.Unmarshal(f.ParsedData, &parsed); err == nil && len(parsed.Episode) > 0 {
							if epNum, ok := util.StringToInt(parsed.Episode); ok && epNum > 0 {
								meta.Episode = epNum
								meta.Episodes = []int{epNum}
								meta.AniDBEpisode = strconv.Itoa(epNum)
							}
						}
					}
					if newMetaBytes, err := json.Marshal(meta); err == nil {
						fixes = append(fixes, fixItem{id: f.ID, meta: newMetaBytes, path: f.Path, episode: meta.Episode})
					}
				}
			}
		}
		// Batch update in chunks of 500
		for i := 0; i < len(fixes); i += 500 {
			end := i + 500
			if end > len(fixes) {
				end = len(fixes)
			}
			batch := fixes[i:end]

			err := d.gormdb.Transaction(func(tx *gorm.DB) error {
				for _, fx := range batch {
					if err := tx.Model(&models.LocalFile{}).Where("id = ?", fx.id).Update("metadata", fx.meta).Error; err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				failed = true
				logger.Error().Err(err).Msg("db: fallo en batch heal Kai files")
				continue
			}
			for _, fx := range batch {
				if fx.episode > 0 {
					logger.Info().Str("path", fx.path).Int("episode", fx.episode).Msg("db: restaurado archivo de Dragon Ball Kai a episodio principal")
				}
			}
		}
	}

	if failed {
		return
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_kai_v1 como completado")
	}
}

// healDragonBallMoviesAndSpecials repara colisiones de TMDB (como TMDB 39322 Dark Nature)
// y registros huérfanos/incompletos de Dragon Ball Serie sin póster para los 6 especiales educativos y de colaboración.
func healDragonBallMoviesAndSpecials(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_movies_and_specials_v2"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	// Si algún paso falla no se marca la migración, para reintentarla al próximo arranque.
	failed := false

	// 1. Corregir colisión Dark Nature -> Dragon Ball: Seguridad Vial de Goku
	resDarkNature := d.gormdb.Exec(`
		UPDATE library_media
		SET title_spanish = ?, title_english = ?, title_romaji = ?, description = ?,
		    poster_image = ?, banner_image = ?, year = 1988, genres = NULL, tags = NULL,
		    format = 'MOVIE', type = 'MOVIE'
		WHERE tmdb_id = 39322 OR id = 1039322 OR LOWER(title_spanish) LIKE '%dark nature%' OR LOWER(title_english) LIKE '%dark nature%'
	`,
		"Dragon Ball: Seguridad Vial de Goku",
		"Dragon Ball: Goku's Traffic Safety",
		"Dragon Ball: Gokū no Kōtsū Anzen",
		"Cortometraje educativo donde Goku viaja a la Capital del Oeste para celebrar el cumpleaños de Bulma, aprendiendo las normas de tráfico y seguridad vial peatonal.",
		"https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg",
		"https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg",
	)
	if resDarkNature.Error != nil {
		failed = true
		logger.Warn().Err(resDarkNature.Error).Msg("db: error corrigiendo colisión Dark Nature")
	} else if resDarkNature.RowsAffected > 0 {
		logger.Info().Int64("rows", resDarkNature.RowsAffected).Msg("db: colisión Dark Nature reparada a Dragon Ball: Seguridad Vial")
	}

	// 2. Eliminar entradas huérfanas de Dragon Ball Serie sin póster que no tengan archivos locales asociados
	if err := d.gormdb.Exec(`
		DELETE FROM library_media
		WHERE (title_spanish = 'Dragon Ball Serie' OR title_spanish = 'Dragon Ball Series')
		  AND (poster_image IS NULL OR poster_image = '')
		  AND id NOT IN (SELECT DISTINCT library_media_id FROM local_file WHERE library_media_id IS NOT NULL AND library_media_id != 0)
	`).Error; err != nil {
		failed = true
		logger.Warn().Err(err).Msg("db: error eliminando Dragon Ball Serie huérfanas")
	}

	// 3. Para las que sí tengan archivos locales o coincidan con los IDs de los 6 especiales, hidratar correctamente
	type specUpdate struct {
		tmdbId  int
		spanish string
		english string
		romaji  string
		desc    string
		poster  string
		banner  string
		year    int
	}
	specials := []specUpdate{
		{
			tmdbId:  39321,
			spanish: "Dragon Ball: El Cuerpo de Bomberos de Goku",
			english: "Dragon Ball: Goku's Fire Brigade",
			romaji:  "Dragon Ball: Gokū no Shōbōtai",
			desc:    "Cortometraje educativo en el que Goku, Krilin, Yamcha y el Maestro Roshi enseñan lecciones vitales de prevención y seguridad contra incendios ante situaciones de emergencia.",
			poster:  "https://image.tmdb.org/t/p/w500/k0QRU1UpJCvoConl1CSlz1RF54s.jpg",
			banner:  "https://image.tmdb.org/t/p/original/tZuNziXpjmOsDlmiT6adFPmmSKT.jpg",
			year:    1988,
		},
		{
			tmdbId:  39322,
			spanish: "Dragon Ball: Seguridad Vial de Goku",
			english: "Dragon Ball: Goku's Traffic Safety",
			romaji:  "Dragon Ball: Gokū no Kōtsū Anzen",
			desc:    "Cortometraje educativo donde Goku viaja a la Capital del Oeste para celebrar el cumpleaños de Bulma, aprendiendo las normas de tráfico y seguridad vial peatonal.",
			poster:  "https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg",
			banner:  "https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg",
			year:    1988,
		},
		{
			tmdbId:  39325,
			spanish: "Dragon Ball Z: ¡Todos Reunidos! El Mundo de Goku",
			english: "Dragon Ball Z: Gather Together! Goku's World",
			romaji:  "Dragon Ball Z: Atsumare! Gokū Wārudo",
			desc:    "Especial interactivo para Terebikko donde Goku, Gohan, Krilin y Trunks viajan en la máquina del tiempo repasando batallas pasadas mientras enfrentan a Cell.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    1992,
		},
		{
			tmdbId:  39326,
			spanish: "Dragon Ball Z: ¡Te lo Mostramos Todo! Olvida el Año con Dragon Ball Z",
			english: "Dragon Ball Z: Looking Back at it All: The Year-End Show",
			romaji:  "Dragon Ball Z: Nenmatsu Tokuban Kessaku Renpatsu Dai Hōsō",
			desc:    "Especial televisivo de fin de año donde Goku y Gohan con atuendo formal repasan los momentos y batallas cumbre de la saga de los Saiyajin, Freezer y Cell.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    1993,
		},
		{
			tmdbId:  105973,
			spanish: "Dragon Ball Z: Los Aventureros de la Esfera del Pánico Regresan",
			english: "Dragon Ball Z: Kyutai Panic Adventure Returns!",
			romaji:  "Dragon Ball Z: Kyūtai Panikku Adobenchā Ritānzu!",
			desc:    "Especial de animación exclusivo de Fuji TV donde Goku y los Guerreros Z unen fuerzas con Luffy y los piratas de Sombrero de Paja para defender la sede esférica.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    2004,
		},
		{
			tmdbId:  444390,
			spanish: "Dream 9: Toriko x One Piece x Dragon Ball Z Super Colaboración",
			english: "Dream 9: Toriko & One Piece & Dragon Ball Z Super Collaboration Special!!",
			romaji:  "Dream 9: Toriko & One Piece & Dragon Ball Z Chō Collaboration Special!!",
			desc:    "Histórico crossover donde Goku, Toriko y Luffy compiten en la Carrera de la Organización Gourmet Internacional y enfrentan juntos a una voraz criatura marina.",
			poster:  "https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg",
			banner:  "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg",
			year:    2013,
		},
	}

	for _, sp := range specials {
		if err := d.gormdb.Exec(`
			UPDATE library_media
			SET title_spanish = ?, title_english = ?, title_romaji = ?, description = ?, poster_image = ?, banner_image = ?, year = ?, format = 'MOVIE', type = 'MOVIE'
			WHERE (tmdb_id = ? OR id = ? OR id = ?) AND (poster_image IS NULL OR poster_image = '' OR title_spanish = 'Dragon Ball Serie' OR title_spanish = 'Dragon Ball Series')
		`, sp.spanish, sp.english, sp.romaji, sp.desc, sp.poster, sp.banner, sp.year, sp.tmdbId, sp.tmdbId, sp.tmdbId+1000000).Error; err != nil {
			failed = true
			logger.Warn().Err(err).Int("tmdbId", sp.tmdbId).Msg("db: error hidratando especial de Dragon Ball")
		}
	}

	if failed {
		return
	}
	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_movies_and_specials_v2 como completado")
	}
}

// healDragonBallShortsArt corrige, UNA SOLA VEZ, el arte de los dos cortos
// educativos de 1988. heal_dragonball_movies_and_specials_v2 les puso el
// backdrop horizontal de la serie como póster (se veía recortado en las cards
// 2:3); en TMDB viven como 1305965 (Bomberos) y 1259215 (Seguridad Vial).
// Solo pisa filas que todavía tienen ese póster heredado.
func healDragonBallShortsArt(d *Database, logger *zerolog.Logger) {
	const migrationKey = "heal_dragonball_shorts_art_v1"
	if migrationDone(d, logger, migrationKey) {
		return
	}

	const legacyPoster = "https://image.tmdb.org/t/p/w500/30L49n4Dhn7dzuGG50GV3ybMhC3.jpg"
	shorts := []struct {
		tmdbID         int
		poster, banner string
	}{
		{39321, "https://image.tmdb.org/t/p/w500/k0QRU1UpJCvoConl1CSlz1RF54s.jpg", "https://image.tmdb.org/t/p/original/tZuNziXpjmOsDlmiT6adFPmmSKT.jpg"},
		{39322, "https://image.tmdb.org/t/p/w500/iM7Rn5oziVlPEhQ7eyCHcYEy5vu.jpg", "https://image.tmdb.org/t/p/original/xX4nWD5tZiHVTNyWscZR5s3iVH.jpg"},
	}
	for _, sh := range shorts {
		res := d.gormdb.Exec(`
			UPDATE library_media SET poster_image = ?, banner_image = ?
			WHERE (tmdb_id = ? OR id = ?) AND poster_image = ?
		`, sh.poster, sh.banner, sh.tmdbID, sh.tmdbID+1000000, legacyPoster)
		if res.Error != nil {
			logger.Warn().Err(res.Error).Int("tmdbId", sh.tmdbID).Msg("db: error corrigiendo arte de corto de Dragon Ball")
			return
		}
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		logger.Error().Err(err).Msg("db: no se pudo marcar heal_dragonball_shorts_art_v1 como completado")
	}
}
