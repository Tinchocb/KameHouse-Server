package scanner

import (
	"encoding/json"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/samber/lo"
)

// persistMatchedMedia saves LibraryMedia records to the database and maps their IDs back to LocalFiles.
func (scn *Scanner) persistMatchedMedia(allMatchedIds map[int]struct{}, movieIds map[int]bool, normalizedMedia []*dto.NormalizedMedia, localFiles []*dto.LocalFile) map[int]uint {
	libraryMediaIdMap := make(map[int]uint)
	mediaBatch := make([]*models.LibraryMedia, 0, len(allMatchedIds))
	tagger := metadata_provider.NewIntelligenceTagger()

	normalizedMap := make(map[int]*dto.NormalizedMedia)
	for _, nm := range normalizedMedia {
		normalizedMap[nm.ID] = nm
	}

	for id := range allMatchedIds {
		realTmdbId := id
		if movieIds[id] {
			realTmdbId = id - 1_000_000
		}

		mediaType := "SHOW"
		if movieIds[id] {
			mediaType = "MOVIE"
		}

		newMedia := &models.LibraryMedia{
			Type:   mediaType,
			TmdbId: realTmdbId,
		}

		if nm, ok := normalizedMap[id]; ok {
			if nm.Title != nil {
				if nm.Title.Romaji != nil {
					newMedia.TitleRomaji = *nm.Title.Romaji
				}
				if nm.Title.English != nil {
					newMedia.TitleEnglish = *nm.Title.English
				}
				if nm.Title.Spanish != nil {
					newMedia.TitleSpanish = *nm.Title.Spanish
				}
				if nm.Title.Native != nil {
					newMedia.TitleOriginal = *nm.Title.Native
				}
			}
			if nm.Format != nil {
				newMedia.Format = string(*nm.Format)
			}
			if nm.Year != nil {
				newMedia.Year = *nm.Year
			}
			if nm.Episodes != nil {
				newMedia.TotalEpisodes = *nm.Episodes
			}
			if nm.CoverImage != nil && nm.CoverImage.Large != nil {
				newMedia.PosterImage = *nm.CoverImage.Large
			}
			if nm.BannerImage != nil {
				newMedia.BannerImage = *nm.BannerImage
			}
			if nm.Description != nil {
				newMedia.Description = *nm.Description
			}
			if nm.MetadataStatus != nil {
				newMedia.MetadataStatus = *nm.MetadataStatus
			}
			if nm.LogoImage != nil {
				newMedia.LogoImage = *nm.LogoImage
			}
			if nm.ThumbImage != nil {
				newMedia.ThumbImage = *nm.ThumbImage
			}
			if nm.ClearArtImage != nil {
				newMedia.ClearArtImage = *nm.ClearArtImage
			}
			if nm.Score != nil {
				newMedia.Score = *nm.Score
			}
			if len(nm.Genres) > 0 {
				genreStrs := make([]string, 0, len(nm.Genres))
				for _, g := range nm.Genres {
					if g != nil {
						genreStrs = append(genreStrs, *g)
					}
				}
				if jb, err := json.Marshal(genreStrs); err == nil {
					newMedia.Genres = jb
				}
			}

			// Intelligence & Tagging V2
			analysis := tagger.Analyze(fmt.Sprintf("%d", realTmdbId), newMedia.GetPreferredTitle(), newMedia.Description, newMedia.Type == "MOVIE")
			newMedia.Tags = analysis.GetTagsAsJSON()
			newMedia.DominantVibe = analysis.DominantVibe
			newMedia.SuggestedSwimlane = analysis.SuggestedSwimlane
		}

		if newMedia.TitleRomaji == "" && newMedia.TitleEnglish == "" {
			newMedia.TitleEnglish = fmt.Sprintf("TMDB Media %d", realTmdbId)
		}

		mediaBatch = append(mediaBatch, newMedia)
	}

	if len(mediaBatch) > 0 {
		scn.Logger.Debug().Int("batchSize", len(mediaBatch)).Msg("scanner: Persisting matched media batch")
		err := db.UpsertLibraryMediaBatch(scn.Database, mediaBatch, 10)
		if err != nil {
			scn.Logger.Warn().Err(err).Msg("scanner: Failed to bulk upsert LibraryMedia batch")
		}

		var insertedMedia []*models.LibraryMedia
		if scn.Database != nil {
			tmdbIds := lo.Map(mediaBatch, func(m *models.LibraryMedia, _ int) int { return m.TmdbId })
			scn.Database.Gorm().Where("tmdb_id IN ?", tmdbIds).Find(&insertedMedia)
			
			scn.Logger.Debug().Int("insertedCount", len(insertedMedia)).Msg("scanner: Retrieved persisted LibraryMedia records")
			
			for _, m := range insertedMedia {
				mapKey := m.TmdbId
				if m.Type == "MOVIE" {
					mapKey = m.TmdbId + 1_000_000
				}
				libraryMediaIdMap[mapKey] = m.ID
			}
		}
	}

	missingAssocCount := 0
	for _, lf := range localFiles {
		if lf.MediaId != 0 {
			if libId, ok := libraryMediaIdMap[lf.MediaId]; ok {
				lf.LibraryMediaId = libId
			} else {
				missingAssocCount++
				scn.Logger.Trace().
					Str("path", lf.Path).
					Int("mediaId", lf.MediaId).
					Msg("scanner: Local file matched media but failed to find internal LibraryMedia association")
			}
		}
	}

	if missingAssocCount > 0 {
		scn.Logger.Warn().Int("missingCount", missingAssocCount).Msg("scanner: Some local files matched media but failed to associate with a database record")
	} else {
		scn.Logger.Debug().Msg("scanner: All matched local files successfully associated with LibraryMedia records")
	}

	return libraryMediaIdMap
}

// persistLocalFiles saves the final state of all LocalFiles to the relational database.
func (scn *Scanner) persistLocalFiles(localFiles []*dto.LocalFile) {
	if len(localFiles) > 0 {
		err := db.UpsertLocalFileRelationalBatch(scn.Database, localFiles)
		if err != nil {
			scn.Logger.Error().Err(err).Msg("scanner: Failed to save local files to database")
		} else {
			scn.Logger.Info().Int("count", len(localFiles)).Msg("scanner: Local files persisted to database")
		}
	}
}
