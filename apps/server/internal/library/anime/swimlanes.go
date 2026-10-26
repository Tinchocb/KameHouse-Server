package anime

import (
	"context"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/sync/singleflight"
	"kamehouse/internal/util/cache"
)

var curatedHomeCache = cache.NewCache[*CuratedHomeResponse](30 * time.Minute)
var dynamicTagLanesCache = cache.NewCache[[]*CuratedSwimlane](30 * time.Minute)
var curatedHomeFlight singleflight.Group

func InvalidateCuratedHomeCache() {
	curatedHomeCache.Clear()
	dynamicTagLanesCache.Clear()
}

func GetCuratedHome(ctx context.Context, database *db.Database) (*CuratedHomeResponse, error) {
	cacheKey := "curated_home"
	if cached, ok := curatedHomeCache.Get(cacheKey); ok && cached != nil {
		return cached, nil
	}

	val, err, _ := curatedHomeFlight.Do(cacheKey, func() (interface{}, error) {
		// Double check inside singleflight
		if cached, ok := curatedHomeCache.Get(cacheKey); ok && cached != nil {
			return cached, nil
		}

		var logger *zerolog.Logger
		if database != nil {
			logger = database.Logger
		}
		svc := NewIntelligenceService(database, nil, logger)

		// Desacoplar del context del primer request HTTP usando context.WithoutCancel
		// con un timeout de 20s para evitar que un aborto individual corte el cálculo compartido.
		sfCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 20*time.Second)
		defer cancel()

		resp, err := svc.GetCuratedSwimlanes(sfCtx)
		if err != nil {
			return nil, err
		}

		curatedHomeCache.Set(cacheKey, resp)
		return resp, nil
	})

	if err != nil {
		return nil, err
	}
	return val.(*CuratedHomeResponse), nil
}

func (s *IntelligenceService) buildEpisodeSwimlaneByTag(id, title, tag string) *CuratedSwimlane {
	query := fmt.Sprintf(`%%"%s"%%`, tag)
	var episodes []models.LibraryEpisode
	if err := s.db.Gorm().
		Select("id, library_media_id, episode_number, title").
		Where("tags LIKE ?", query).
		Order("episode_number ASC").
		Limit(20).
		Find(&episodes).Error; err != nil || len(episodes) == 0 {
		return nil
	}

	mediaIDs := make([]uint, 0, len(episodes))
	for _, ep := range episodes {
		mediaIDs = append(mediaIDs, ep.LibraryMediaID)
	}

	var mediaList []models.LibraryMedia
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("id IN (?)", mediaIDs).
		Find(&mediaList).Error; err != nil {
		return nil
	}

	mediaMap := make(map[uint]*models.LibraryMedia)
	for i := range mediaList {
		mediaMap[mediaList[i].ID] = &mediaList[i]
	}

	lane := &CuratedSwimlane{
		ID:      id,
		Title:   title,
		Type:    "episode_tag",
		Entries: make([]*LibraryCollectionEntry, 0, len(episodes)),
	}

	added := make(map[uint]bool)
	for i := range episodes {
		ep := &episodes[i]
		if added[ep.ID] {
			continue
		}
		media, ok := mediaMap[ep.LibraryMediaID]
		if !ok {
			continue
		}
		if media.PosterImage == "" || media.GetPreferredTitle() == "" {
			continue
		}
		added[ep.ID] = true
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            media,
			MediaID:          int(media.ID),
			Episode:          ep,
			AvailabilityType: "FULL_LOCAL",
		})
	}

	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

type EpisodeLaneDef struct {
	ID   string
	Name string
}

func (s *IntelligenceService) buildEpisodeSwimlanesBatch(laneDefs []EpisodeLaneDef) []*CuratedSwimlane {
	if len(laneDefs) == 0 {
		return nil
	}

	laneNames := make([]string, len(laneDefs))
	for i, l := range laneDefs {
		laneNames[i] = l.Name
	}

	// Tope de 20 episodios POR lane resuelto en SQL (ventana por suggested_swimlane):
	// un LIMIT global ordenado por episode_number dejaba sin episodios a las lanes
	// cuyos números de episodio son más altos.
	const laneEpisodesSQL = `
		SELECT id, library_media_id, episode_number, title, suggested_swimlane
		FROM (
			SELECT id, library_media_id, episode_number, title, suggested_swimlane,
				ROW_NUMBER() OVER (PARTITION BY suggested_swimlane ORDER BY episode_number ASC) AS rn
			FROM library_episodes
			WHERE suggested_swimlane IN ?
		)
		WHERE rn <= 20
		ORDER BY episode_number ASC`
	var allEpisodes []models.LibraryEpisode
	if err := s.db.Gorm().Raw(laneEpisodesSQL, laneNames).Scan(&allEpisodes).Error; err != nil || len(allEpisodes) == 0 {
		return nil
	}

	// Group episodes by lane name (max 20 per lane)
	episodesByLane := make(map[string][]models.LibraryEpisode)
	mediaIDMap := make(map[uint]struct{})

	for _, ep := range allEpisodes {
		list := episodesByLane[ep.SuggestedSwimlane]
		if len(list) < 20 {
			episodesByLane[ep.SuggestedSwimlane] = append(list, ep)
			mediaIDMap[ep.LibraryMediaID] = struct{}{}
		}
	}

	if len(mediaIDMap) == 0 {
		return nil
	}

	mediaIDs := make([]uint, 0, len(mediaIDMap))
	for id := range mediaIDMap {
		mediaIDs = append(mediaIDs, id)
	}

	var mediaList []models.LibraryMedia
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("id IN (?)", mediaIDs).
		Find(&mediaList).Error; err != nil {
		return nil
	}

	mediaMap := make(map[uint]*models.LibraryMedia)
	for i := range mediaList {
		mediaMap[mediaList[i].ID] = &mediaList[i]
	}

	resultLanes := make([]*CuratedSwimlane, 0, len(laneDefs))
	for _, def := range laneDefs {
		episodes, ok := episodesByLane[def.Name]
		if !ok || len(episodes) == 0 {
			continue
		}

		title := def.Name
		if episodes[0].SuggestedSwimlane != "" {
			title = episodes[0].SuggestedSwimlane
		}

		lane := &CuratedSwimlane{
			ID:      def.ID,
			Title:   title,
			Type:    "episode_tag",
			Entries: make([]*LibraryCollectionEntry, 0, len(episodes)),
		}

		added := make(map[uint]bool)
		for i := range episodes {
			ep := &episodes[i]
			if added[ep.ID] {
				continue
			}
			media, ok := mediaMap[ep.LibraryMediaID]
			if !ok {
				continue
			}
			if media.PosterImage == "" || media.GetPreferredTitle() == "" {
				continue
			}
			added[ep.ID] = true
			lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
				Media:            media,
				MediaID:          int(media.ID),
				Episode:          ep,
				AvailabilityType: "FULL_LOCAL",
			})
		}

		if len(lane.Entries) > 0 {
			resultLanes = append(resultLanes, lane)
		}
	}

	return resultLanes
}

func (s *IntelligenceService) buildLocalLibraryLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?)", hasFiles).
		Order("updated_at DESC").
		Limit(40).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "local_library",
		Title:   "Tu Videoteca Local",
		Type:    "local_library",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildEpicMomentsLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND score >= ?", hasFiles, epicScoreThreshold).
		Order("score DESC").
		Limit(40).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "epic_moments",
		Title:   "Sagas Legendarias y Épicas",
		Type:    "epic_moments",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "HYBRID",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildEssentialCinemaLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND format IN ?", hasFiles, []string{"MOVIE", "OVA", "SPECIAL"}).
		Order("score DESC").
		Limit(30).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "essential_cinema",
		Title:   "Cine Esencial: Películas Dragon Ball",
		Type:    "essential_cinema",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}

func (s *IntelligenceService) buildTrendingLane() *CuratedSwimlane {
	var media []*models.LibraryMedia
	hasFiles := s.db.Gorm().Model(&models.LocalFile{}).Select("1").
		Where("library_media_id = library_media.id AND library_media_id > 0").Limit(1)
	if err := s.db.Gorm().
		Omit("description", "synonyms", "audio_tracks", "subtitle_tracks").
		Where("EXISTS (?) AND format = ?", hasFiles, "TV").
		Order("created_at DESC").
		Limit(20).
		Find(&media).Error; err != nil || len(media) == 0 {
		return nil
	}
	lane := &CuratedSwimlane{
		ID:      "trending",
		Title:   "Series Dragon Ball: Tu Colección",
		Type:    "trending",
		Entries: make([]*LibraryCollectionEntry, 0, len(media)),
	}
	for _, m := range media {
		if m.PosterImage == "" || m.GetPreferredTitle() == "" {
			continue
		}
		lane.Entries = append(lane.Entries, &LibraryCollectionEntry{
			Media:            m,
			MediaID:          int(m.ID),
			AvailabilityType: "FULL_LOCAL",
		})
	}
	if len(lane.Entries) == 0 {
		return nil
	}
	return lane
}
