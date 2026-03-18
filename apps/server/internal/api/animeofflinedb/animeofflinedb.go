package animeofflinedb

import (
	"bufio"
	"errors"
	"kamehouse/internal/database/models/dto"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/goccy/go-json"
)

const (
	DatabaseURL = "https://github.com/manami-project/anime-offline-database/releases/download/latest/anime-offline-database.jsonl"
)

type animeEntry struct {
	Sources     []string    `json:"sources"`
	Title       string      `json:"title"`
	Type        string      `json:"type"`
	Episodes    int         `json:"episodes"`
	Status      string      `json:"status"`
	AnimeSeason animeSeason `json:"animeSeason"`
	Picture     string      `json:"picture"`
	Thumbnail   string      `json:"thumbnail"`
	Synonyms    []string    `json:"synonyms"`
}

type animeSeason struct {
	Season string `json:"season"`
	Year   int    `json:"year"`
}

const (
	malPrefix       = "https://myanimelist.net/anime/"
	tmdbTvPrefix    = "https://themoviedb.org/tv/"
	tmdbMoviePrefix = "https://themoviedb.org/movie/"
	tvdbPrefix      = "https://thetvdb.com/series/"
)

var (
	normalizedMediaCache   []*dto.NormalizedMedia
	normalizedMediaCacheMu sync.RWMutex
)

// FetchAndConvertDatabase fetches the database and converts entries to NormalizedMedia.
// Only entries with valid provider IDs are included.
// Entries that already exist in existingMediaIDs are excluded.
func FetchAndConvertDatabase(existingMediaIDs map[int]bool) ([]*dto.NormalizedMedia, error) {
	// check cache first
	normalizedMediaCacheMu.RLock()
	if normalizedMediaCache != nil {
		// filter cached results by existingMediaIDs
		result := filterByExistingIDs(normalizedMediaCache, existingMediaIDs)
		normalizedMediaCacheMu.RUnlock()
		return result, nil
	}
	normalizedMediaCacheMu.RUnlock()

	resp, err := http.Get(DatabaseURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to fetch database: " + resp.Status)
	}

	// stream and convert directly to NormalizedMedia
	// estimate ~20300 entries with provider ids
	allMedia := make([]*dto.NormalizedMedia, 0, 20300)
	result := make([]*dto.NormalizedMedia, 0, 20300)

	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		if lineNum == 1 {
			continue // skip metadata line
		}

		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		// parse entry
		var entry animeEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		// convert immediately and discard raw entry
		media := convertEntryToNormalizedMedia(&entry)
		if media == nil {
			continue // no tmdb id or provider id
		}

		// add to cache (all media with provider ids)
		allMedia = append(allMedia, media)

		// check if should be included in result
		if existingMediaIDs == nil || !existingMediaIDs[media.ID] {
			result = append(result, media)
		}
		// entry goes out of scope here and can be GC'd
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// cache all media for future calls?
	normalizedMediaCacheMu.Lock()
	normalizedMediaCache = allMedia
	normalizedMediaCacheMu.Unlock()

	return result, nil
}

// filterByExistingIDs filters cached media by existing IDs
func filterByExistingIDs(media []*dto.NormalizedMedia, existingMediaIDs map[int]bool) []*dto.NormalizedMedia {
	if existingMediaIDs == nil || len(existingMediaIDs) == 0 {
		return media
	}

	result := make([]*dto.NormalizedMedia, 0, len(media))
	for _, m := range media {
		if !existingMediaIDs[m.ID] {
			result = append(result, m)
		}
	}
	return result
}

// ClearCache clears the normalized media cache
func ClearCache() {
	normalizedMediaCacheMu.Lock()
	normalizedMediaCache = nil
	normalizedMediaCacheMu.Unlock()
}

// convertEntryToNormalizedMedia converts an animeEntry to NormalizedMedia.
// Returns nil if the entry has no external provider id.
func convertEntryToNormalizedMedia(e *animeEntry) *dto.NormalizedMedia {
	tmdbID := extractTmdbID(e.Sources)
	// We require at least one ID to store it effectively
	if tmdbID == 0 {
		return nil
	}

	malID := extractMALID(e.Sources)
	var malIDPtr *int
	if malID > 0 {
		malIDPtr = &malID
	}

	var tmdbIDPtr *int
	if tmdbID > 0 {
		tmdbIDPtr = &tmdbID
	}

	tvdbID := extractTvdbID(e.Sources)
	var tvdbIDPtr *int
	if tvdbID > 0 {
		tvdbIDPtr = &tvdbID
	}

	// convert type to dto.MediaFormat
	var format *dto.MediaFormat
	switch e.Type {
	case "TV":
		f := dto.MediaFormatTV
		format = &f
	case "MOVIE":
		f := dto.MediaFormatMovie
		format = &f
	case "OVA":
		f := dto.MediaFormatOVA
		format = &f
	case "ONA":
		f := dto.MediaFormatONA
		format = &f
	case "SPECIAL":
		f := dto.MediaFormatSpecial
		format = &f
	}

	// convert status to dto.MediaStatus
	var status *dto.MediaStatus
	switch e.Status {
	case "FINISHED":
		s := dto.MediaStatusFinished
		status = &s
	case "ONGOING":
		s := dto.MediaStatusReleasing
		status = &s
	case "UPCOMING":
		s := dto.MediaStatusNotYetReleased
		status = &s
	}

	// convert season to dto.MediaSeason
	var season *dto.MediaSeason
	switch e.AnimeSeason.Season {
	case "SPRING":
		s := dto.MediaSeasonSpring
		season = &s
	case "SUMMER":
		s := dto.MediaSeasonSummer
		season = &s
	case "FALL":
		s := dto.MediaSeasonFall
		season = &s
	case "WINTER":
		s := dto.MediaSeasonWinter
		season = &s
	}

	// reuse the same string pointer for all title fields
	title := e.Title
	titleObj := &dto.NormalizedMediaTitle{
		Romaji:        &title,
		English:       &title,
		UserPreferred: &title,
	}

	// build synonyms
	var synonyms []*string
	if len(e.Synonyms) > 0 {
		synonyms = make([]*string, len(e.Synonyms))
		for i := range e.Synonyms {
			synonyms[i] = &e.Synonyms[i]
		}
	}

	// build start date
	var startDate *dto.NormalizedMediaDate
	if e.AnimeSeason.Year > 0 {
		year := e.AnimeSeason.Year
		startDate = &dto.NormalizedMediaDate{
			Year: &year,
		}
	}

	var episodes *int
	if e.Episodes > 0 {
		ep := e.Episodes
		episodes = &ep
	}

	var year *int
	if e.AnimeSeason.Year > 0 {
		y := e.AnimeSeason.Year
		year = &y
	}

	var coverImage *dto.NormalizedMediaCoverImage
	if e.Thumbnail != "" || e.Picture != "" {
		coverImage = &dto.NormalizedMediaCoverImage{
			Large:  &e.Picture,
			Medium: &e.Thumbnail,
		}
	}

	primaryID := tmdbID


	return dto.NewNormalizedMediaFromOfflineDB(
		primaryID, 
		malIDPtr,
		tmdbIDPtr,
		tvdbIDPtr,
		titleObj,
		synonyms,
		format,
		status,
		season,
		year,
		startDate,
		episodes,
		coverImage,
	)
}


func extractMALID(sources []string) int {
	for _, source := range sources {
		if strings.HasPrefix(source, malPrefix) {
			idStr := source[len(malPrefix):]
			if idx := strings.IndexAny(idStr, "/?"); idx != -1 {
				idStr = idStr[:idx]
			}
			if id, err := strconv.Atoi(idStr); err == nil {
				return id
			}
		}
	}
	return 0
}

// GetTmdbIdFromThirdParty extracts TMDB ID from the cache based on external provider IDs.
func GetTmdbIdFromThirdParty(tvdbId int) int {
	normalizedMediaCacheMu.RLock()
	defer normalizedMediaCacheMu.RUnlock()

	if normalizedMediaCache == nil {
		return 0
	}

	for _, media := range normalizedMediaCache {
		if media.TmdbId != nil {
			if tvdbId > 0 && media.TvdbId != nil && *media.TvdbId == tvdbId {
				return *media.TmdbId
			}
		}
	}

	return 0
}
func extractTmdbID(sources []string) int {
	for _, source := range sources {
		prefix := ""
		if strings.HasPrefix(source, tmdbTvPrefix) {
			prefix = tmdbTvPrefix
		} else if strings.HasPrefix(source, tmdbMoviePrefix) {
			prefix = tmdbMoviePrefix
		}

		if prefix != "" {
			idStr := source[len(prefix):]
			if idx := strings.IndexAny(idStr, "/?-"); idx != -1 {
				idStr = idStr[:idx]
			}
			if id, err := strconv.Atoi(idStr); err == nil {
				return id
			}
		}
	}
	return 0
}

func extractTvdbID(sources []string) int {
	for _, source := range sources {
		if strings.HasPrefix(source, tvdbPrefix) {
			idStr := source[len(tvdbPrefix):]
			if idx := strings.IndexAny(idStr, "/?-"); idx != -1 {
				idStr = idStr[:idx]
			}
			if id, err := strconv.Atoi(idStr); err == nil {
				return id
			}
		}
	}
	return 0
}
