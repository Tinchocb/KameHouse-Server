package scanner

import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"time"

	"github.com/samber/lo"
	apiMetadata "kamehouse/internal/api/metadata"
)

// enrichMediaMetadata fetches additional metadata (seasons, episodes, sagas) for TV shows.
func (scn *Scanner) enrichMediaMetadata(ctx context.Context, libraryMediaIdMap map[int]uint, movieIds map[int]bool, localFiles []*dto.LocalFile) error {
	mediaFetched := make(map[int]bool)
	var allSeasons []*models.LibrarySeason
	var allEpisodes []*models.LibraryEpisode
	tagger := metadata_provider.NewIntelligenceTagger()

	for tmdbMediaId, libMediaId := range libraryMediaIdMap {
		if movieIds[tmdbMediaId] || movieIds[tmdbMediaId-1_000_000] {
			continue // Skip movies
		}

		positiveTmdbId := tmdbMediaId
		if positiveTmdbId <= 0 {
			continue
		}
		if mediaFetched[positiveTmdbId] {
			continue
		}
		mediaFetched[positiveTmdbId] = true

		scn.Logger.Info().Int("tmdbId", positiveTmdbId).Msg("scanner: Fetching enriched episode metadata")

		if scn.MetadataProviderRef == nil || scn.MetadataProviderRef.IsAbsent() {
			continue
		}
		provider := scn.MetadataProviderRef.Get()

		animeMeta, err := provider.GetAnimeMetadata(positiveTmdbId)
		if err != nil {
			scn.Logger.Debug().Err(err).Int("tmdbId", positiveTmdbId).Msg("scanner: Enrichment skipped (provider error or missing API key)")
			continue
		}
		if animeMeta == nil {
			continue
		}

		// Update LibraryMedia with AniDB and MAL IDs
		if animeMeta.Mappings != nil {
			_ = db.UpdateLibraryMediaMappings(scn.Database, libMediaId, animeMeta.Mappings.AnidbId, animeMeta.Mappings.MyanimelistId)
		}

		episodesBySeason := make(map[int][]*apiMetadata.EpisodeMetadata)
		for _, ep := range animeMeta.Episodes {
			episodesBySeason[ep.SeasonNumber] = append(episodesBySeason[ep.SeasonNumber], ep)
		}

		for seasonNum, eps := range episodesBySeason {
			if ctx.Err() != nil {
				return ctx.Err()
			}

			seasonTitle := fmt.Sprintf("Season %d", seasonNum)
			if seasonNum == 0 {
				seasonTitle = "Specials"
			}

			var seasonImage string
			seasonDescription := ""
			if scn.TMDBClient != nil {
				if sDetails, err := scn.TMDBClient.GetTVSeason(ctx, positiveTmdbId, seasonNum); err == nil {
					seasonTitle = sDetails.Name
					seasonDescription = sDetails.Overview
					if sDetails.PosterPath != "" {
						seasonImage = "https://image.tmdb.org/t/p/w500" + sDetails.PosterPath
					}
				}
			}

			allSeasons = append(allSeasons, &models.LibrarySeason{
				LibraryMediaID: libMediaId,
				SeasonNumber:   seasonNum,
				Title:          seasonTitle,
				Description:    seasonDescription,
				Image:          seasonImage,
			})

			for _, ep := range eps {
				libEp := &models.LibraryEpisode{
					LibraryMediaID: libMediaId,
					EpisodeNumber:  ep.EpisodeNumber,
					SeasonNumber:   ep.SeasonNumber,
					Type:           "REGULAR",
					Title:          ep.Title,
					Description:    ep.Overview,
					Image:          ep.Image,
					RuntimeMinutes: ep.Length,
					SagaId:         ep.SagaId,
					SagaName:       ep.SagaName,
					AbsoluteNumber: ep.AbsoluteEpisodeNumber,
				}

				if ep.IsFiller {
					libEp.Type = "FILLER"
				}
				if seasonNum == 0 {
					libEp.Type = "SPECIAL"
				}

				if ep.AirDate != "" {
					if parsedDate, parseErr := time.Parse(time.DateOnly, ep.AirDate); parseErr == nil {
						libEp.AirDate = parsedDate
					}
				}

				// Intelligence & Tagging V2
				analysis := tagger.Analyze(fmt.Sprintf("%d_%d_%d", positiveTmdbId, ep.SeasonNumber, ep.EpisodeNumber), libEp.Title, libEp.Description, false)
				libEp.Tags = analysis.GetTagsAsJSON()
				libEp.DominantVibe = analysis.DominantVibe
				libEp.SuggestedSwimlane = analysis.SuggestedSwimlane

				// Extract languages from local files
				var audioLangs []string
				var subtitleLangs []string
				for _, lf := range localFiles {
					if lf.MediaId == positiveTmdbId && lf.Metadata != nil && lf.Metadata.Episode == ep.EpisodeNumber && lf.GetSeasonNumber() == ep.SeasonNumber {
						if lf.TechnicalInfo != nil {
							for _, a := range lf.TechnicalInfo.AudioStreams {
								if a.Language != "" {
									audioLangs = append(audioLangs, a.Language)
								}
							}
							for _, s := range lf.TechnicalInfo.SubtitleStreams {
								if s.Language != "" {
									subtitleLangs = append(subtitleLangs, s.Language)
								}
							}
						}
					}
				}

				audioLangs = lo.Uniq(audioLangs)
				subtitleLangs = lo.Uniq(subtitleLangs)

				if len(audioLangs) > 0 {
					if b, err := json.Marshal(audioLangs); err == nil {
						libEp.AudioTracks = b
					}
				}
				if len(subtitleLangs) > 0 {
					if b, err := json.Marshal(subtitleLangs); err == nil {
						libEp.SubtitleTracks = b
					}
				}

				allEpisodes = append(allEpisodes, libEp)
			}
		}
	}

	if len(allSeasons) > 0 {
		scn.Logger.Info().Int("count", len(allSeasons)).Msg("scanner: Persisting seasons batch")
		if err := db.UpsertLibrarySeasonBatch(scn.Database, allSeasons, 20); err != nil {
			scn.Logger.Warn().Err(err).Msg("scanner: Failed to persist seasons batch")
		}
	}

	if len(allEpisodes) > 0 {
		scn.Logger.Info().Int("count", len(allEpisodes)).Msg("scanner: Persisting episodes batch")
		if err := db.UpsertLibraryEpisodeBatch(scn.Database, allEpisodes, 50); err != nil {
			scn.Logger.Warn().Err(err).Msg("scanner: Failed to persist episodes batch")
		}
	}

	return nil
}

func (scn *Scanner) resolveSagasForMediaSync(ctx context.Context, tvID int) []sagaResolution {
	if scn.TMDBClient == nil {
		return nil
	}

	tmdbGroups, err := scn.TMDBClient.GetEpisodeGroups(ctx, tvID)
	if err != nil || len(tmdbGroups) == 0 {
		return nil
	}

	sagas := make([]sagaResolution, 0, len(tmdbGroups))
	accumulated := 0

	for _, g := range tmdbGroups {
		startEp := accumulated + 1
		endEp := accumulated + g.Episodes
		accumulated += g.Episodes

		sagas = append(sagas, sagaResolution{
			id:      g.ID,
			name:    g.Name,
			startEp: startEp,
			endEp:   endEp,
		})
	}

	return sagas
}

func findSagaForEpisodeNumber(sagas []sagaResolution, episodeNumber int) (sagaName, sagaID string) {
	for _, saga := range sagas {
		if episodeNumber >= saga.startEp && episodeNumber <= saga.endEp {
			return saga.name, saga.id
		}
	}
	return "", ""
}
