package tmdb_platform

import (
	"context"
	"fmt"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/platforms/platform"
	"strconv"

	"github.com/rs/zerolog"
)

type Platform struct {
	tmdbClient *tmdb.Client
	username   string
}

func NewPlatform(apiKey string, language string) *Platform {
	return &Platform{
		tmdbClient: tmdb.NewClient(apiKey, language),
	}
}

func (p *Platform) SetUsername(username string) {
	p.username = username
}

func (p *Platform) IsAuthenticated() bool {
	return true // For now, we assume API key is enough
}

func (p *Platform) GetCacheDir() string {
	return ""
}

func (p *Platform) CustomQuery(body []byte, logger *zerolog.Logger, token ...string) (interface{}, error) {
	return nil, fmt.Errorf("TMDB platform: CustomQuery not implemented")
}

func (p *Platform) GetAnime(ctx context.Context, mediaID int) (interface{}, error) {
	res, err := p.tmdbClient.GetTVDetails(ctx, strconv.Itoa(mediaID))
	if err != nil {
		return nil, err
	}
	return p.toUnifiedMedia(&res, platform.MediaFormatTv, platform.MediaKindAnime), nil
}

// GetMovie fetches a single movie by TMDB ID. Detects saga membership via BelongsToCollection.
func (p *Platform) GetMovie(ctx context.Context, mediaID int) (interface{}, error) {
	res, err := p.tmdbClient.GetMovieDetailsV2(ctx, mediaID)
	if err != nil {
		return nil, err
	}
	return p.movieDetailsToUnifiedMedia(&res), nil
}

func (p *Platform) GetAnimeByMalID(ctx context.Context, malID int) (interface{}, error) {
	return nil, nil
}

func (p *Platform) GetAnimeWithRelations(ctx context.Context, mediaID int) (interface{}, error) {
	return p.GetAnime(ctx, mediaID)
}

func (p *Platform) GetAnimeDetails(ctx context.Context, mediaID int) (interface{}, error) {
	return p.GetAnime(ctx, mediaID)
}

func (p *Platform) GetCompleteAnime(ctx context.Context, mediaID int) (interface{}, error) {
	return p.GetAnime(ctx, mediaID)
}

// SearchMedia performs a unified search across TV shows and movies, returning kind-tagged results.
func (p *Platform) SearchMedia(ctx context.Context, query string, page *int) (*platform.UnifiedMediaList, error) {
	out := &platform.UnifiedMediaList{}

	// Search TV shows
	tvResults, err := p.tmdbClient.SearchTV(ctx, query)
	if err == nil {
		for _, r := range tvResults {
			out.Media = append(out.Media, p.toUnifiedMedia(&r, platform.MediaFormatTv, platform.MediaKindGeneral))
		}
	}

	// Search movies
	movieResults, err := p.tmdbClient.SearchMovie(ctx, query)
	if err == nil {
		for _, r := range movieResults {
			out.Media = append(out.Media, p.toUnifiedMedia(&r, platform.MediaFormatMovie, platform.MediaKindGeneral))
		}
	}

	return out, nil
}

// GetMediaCollection fetches all movies in a TMDB franchise/saga collection.
func (p *Platform) GetMediaCollection(ctx context.Context, collectionID int) (*platform.UnifiedCollection, error) {
	details, err := p.tmdbClient.GetCollection(ctx, collectionID)
	if err != nil {
		return nil, err
	}

	entries := make([]*platform.UnifiedCollectionEntry, 0, len(details.Parts))
	for i, part := range details.Parts {
		title := part.Title
		if title == "" {
			title = part.OriginalTitle
		}
		var poster, backdrop *string
		if part.PosterPath != "" {
			v := "https://image.tmdb.org/t/p/original" + part.PosterPath
			poster = &v
		}
		if part.BackdropPath != "" {
			v := "https://image.tmdb.org/t/p/original" + part.BackdropPath
			backdrop = &v
		}
		collID := details.ID
		collName := details.Name
		overviewStr := part.Overview
		m := &platform.UnifiedMedia{
			ID:     part.ID,
			Type:   "MOVIE",
			Format: platform.MediaFormatMovie,
			Kind:   platform.MediaKindGeneral,
			Title: &platform.MediaTitle{
				Romaji: &title,
			},
			CoverImage: &platform.MediaCoverImage{
				ExtraLarge: poster,
				Large:      poster,
			},
			BannerImage:    backdrop,
			Overview:       &overviewStr,
			CollectionID:   &collID,
			CollectionName: &collName,
			StartDate:      p.parseDate(part.ReleaseDate),
		}
		entries = append(entries, &platform.UnifiedCollectionEntry{
			ID:    i + 1,
			Media: m,
		})
	}

	collName := details.Name
	collOverview := details.Overview
	collPosterPath := ""
	collBackdropPath := ""
	if details.PosterPath != "" {
		collPosterPath = "https://image.tmdb.org/t/p/original" + details.PosterPath
	}
	if details.BackdropPath != "" {
		collBackdropPath = "https://image.tmdb.org/t/p/original" + details.BackdropPath
	}

	return &platform.UnifiedCollection{
		Lists: []*platform.UnifiedCollectionList{
			{
				Name:         collName,
				Overview:     collOverview,
				PosterPath:   collPosterPath,
				BackdropPath: collBackdropPath,
				Entries:      entries,
			},
		},
	}, nil
}

func (p *Platform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) GetRawAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) GetAnimeCollectionWithRelations(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) AddMediaToCollection(ctx context.Context, mIds []int) error {
	return nil
}

func (p *Platform) SearchAnimeByIds(ctx context.Context, ids []int, page *int, perPage *int, status []platform.MediaStatus, inCollection *bool, sort []platform.MediaSort, season *platform.MediaSeason, year *int, genre *string, format *platform.MediaFormat) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) ListAnime(ctx context.Context, page *int, search *string, perPage *int, sort []platform.MediaSort, status []platform.MediaStatus, genres []string, averageScoreGreater *int, season *platform.MediaSeason, seasonYear *int, format *platform.MediaFormat, isAdult *bool) (interface{}, error) {
	// TMDB discover has somewhat different sorts. Map platform-agnostic sorts to TMDB equivalents:
	tmdbSort := "popularity.desc"
	if len(sort) > 0 {
		switch sort[0] {
		case "TRENDING_DESC", "POPULARITY_DESC":
			tmdbSort = "popularity.desc"
		case "SCORE_DESC":
			tmdbSort = "vote_average.desc"
		case "START_DATE_DESC":
			tmdbSort = "first_air_date.desc"
		case "START_DATE":
			tmdbSort = "first_air_date.asc"
		case "EPISODES_DESC":
			tmdbSort = "vote_count.desc" // rough proxy
		}
	}

	var tmdbStatus *string
	if len(status) > 0 {
		switch status[0] {
		case platform.MediaStatusReleasing:
			st := "0" // Returning series
			tmdbStatus = &st
		case platform.MediaStatusFinished:
			st := "3" // Ended
			tmdbStatus = &st
		case platform.MediaStatusNotYetReleased:
			st := "1" // Planned or In Production
			tmdbStatus = &st
		case platform.MediaStatusCancelled:
			st := "4" // Canceled
			tmdbStatus = &st
		}
	}

	results, _, err := p.tmdbClient.DiscoverTV(ctx, page, &tmdbSort, tmdbStatus, genres, seasonYear, nil, nil)
	if err != nil {
		return nil, err
	}

	out := &platform.UnifiedMediaList{
		Media: make([]*platform.UnifiedMedia, len(results)),
	}
	for i, r := range results {
		out.Media[i] = p.toUnifiedMedia(&r, platform.MediaFormatTv, platform.MediaKindAnime)
	}

	return out, nil
}

func (p *Platform) ListRecentAnime(ctx context.Context, page *int, perPage *int, airingAtGreater *int, airingAtLesser *int, notYetAired *bool) (interface{}, error) {
	tmdbSort := "first_air_date.desc"
	var tmdbStatus *string
	if notYetAired != nil && *notYetAired {
		st := "1"
		tmdbStatus = &st
	}

	results, _, err := p.tmdbClient.DiscoverTV(ctx, page, &tmdbSort, tmdbStatus, nil, nil, airingAtGreater, airingAtLesser)
	if err != nil {
		return nil, err
	}

	out := &platform.UnifiedMediaList{
		Media: make([]*platform.UnifiedMedia, len(results)),
	}
	for i, r := range results {
		out.Media[i] = p.toUnifiedMedia(&r, platform.MediaFormatTv, platform.MediaKindAnime)
	}

	return out, nil
}

func (p *Platform) GetViewer(ctx context.Context) (*platform.UnifiedViewer, error) {
	return &platform.UnifiedViewer{Name: p.username}, nil
}

func (p *Platform) GetViewerStats(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedViewerStats{}, nil
}

func (p *Platform) GetStudioDetails(ctx context.Context, studioID int) (interface{}, error) {
	return &platform.UnifiedStudioDetails{}, nil
}

func (p *Platform) GetAnimeAiringSchedule(ctx context.Context) (interface{}, error) {
	return &platform.UnifiedAiringSchedule{}, nil
}

func (p *Platform) GetAnimeAiringScheduleRaw(ctx context.Context, ids []int) (interface{}, error) {
	return nil, nil
}

func (p *Platform) UpdateEntry(ctx context.Context, mediaID int, status interface{}, scoreRaw *int, progress *int, startedAt interface{}, completedAt interface{}) error {
	return nil
}

func (p *Platform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return nil
}

func (p *Platform) UpdateEntryRepeat(ctx context.Context, mediaID int, repeat int) error {
	return nil
}

func (p *Platform) DeleteEntry(ctx context.Context, mediaID int, entryID int) error {
	return nil
}

func (p *Platform) ClearCache() {}
func (p *Platform) Close()      {}

func (p *Platform) toUnifiedMedia(res *tmdb.SearchResult, format platform.MediaFormat, kind platform.MediaKind) *platform.UnifiedMedia {
	title := &platform.MediaTitle{}
	if res.Name != "" {
		title.Romaji = &res.Name
	} else if res.Title != "" {
		title.Romaji = &res.Title
	}

	if res.OriginalName != "" {
		title.Native = &res.OriginalName
	} else if res.OriginalTitle != "" {
		title.Native = &res.OriginalTitle
	}

	var poster, backdrop *string
	if res.PosterPath != "" {
		v := "https://image.tmdb.org/t/p/original" + res.PosterPath
		poster = &v
	}
	if res.BackdropPath != "" {
		v := "https://image.tmdb.org/t/p/original" + res.BackdropPath
		backdrop = &v
	}

	var overviewPtr *string
	if res.Overview != "" {
		s := res.Overview
		overviewPtr = &s
	}

	m := &platform.UnifiedMedia{
		ID:     res.ID,
		Type:   platform.MediaType("ANIME"),
		Format: format,
		Kind:   kind,
		Title:  title,
		CoverImage: &platform.MediaCoverImage{
			ExtraLarge: poster,
			Large:      poster,
		},
		BannerImage: backdrop,
		Overview:    overviewPtr,
	}

	// Dates
	if res.FirstAirDate != "" {
		m.StartDate = p.parseDate(res.FirstAirDate)
	} else if res.ReleaseDate != "" {
		m.StartDate = p.parseDate(res.ReleaseDate)
	}

	return m
}

// movieDetailsToUnifiedMedia converts a full MovieDetails (with saga info) into UnifiedMedia.
func (p *Platform) movieDetailsToUnifiedMedia(res *tmdb.MovieDetails) *platform.UnifiedMedia {
	title := res.Title
	if title == "" {
		title = res.OriginalTitle
	}
	var poster, backdrop *string
	if res.PosterPath != "" {
		v := "https://image.tmdb.org/t/p/original" + res.PosterPath
		poster = &v
	}
	if res.BackdropPath != "" {
		v := "https://image.tmdb.org/t/p/original" + res.BackdropPath
		backdrop = &v
	}
	var overviewPtr *string
	if res.Overview != "" {
		overviewPtr = &res.Overview
	}
	var imdbPtr *string
	if res.ImdbID != "" {
		imdbPtr = &res.ImdbID
	}
	var collID *int
	var collName *string
	if res.BelongsToCollection != nil {
		id := res.BelongsToCollection.ID
		name := res.BelongsToCollection.Name
		collID = &id
		collName = &name
	}

	m := &platform.UnifiedMedia{
		ID:     res.ID,
		Type:   "MOVIE",
		Format: platform.MediaFormatMovie,
		Kind:   platform.MediaKindGeneral,
		Title: &platform.MediaTitle{
			Romaji: &title,
			Native: &res.OriginalTitle,
		},
		CoverImage: &platform.MediaCoverImage{
			ExtraLarge: poster,
			Large:      poster,
		},
		BannerImage:    backdrop,
		Overview:       overviewPtr,
		IMDbID:         imdbPtr,
		CollectionID:   collID,
		CollectionName: collName,
		StartDate:      p.parseDate(res.ReleaseDate),
	}
	return m
}

func (p *Platform) parseDate(dateStr string) *platform.FuzzyDate {
	// YYYY-MM-DD
	if len(dateStr) >= 10 {
		year, _ := strconv.Atoi(dateStr[0:4])
		month, _ := strconv.Atoi(dateStr[5:7])
		day, _ := strconv.Atoi(dateStr[8:10])
		return &platform.FuzzyDate{
			Year:  &year,
			Month: &month,
			Day:   &day,
		}
	}
	return nil
}

var _ platform.Platform = (*Platform)(nil)
