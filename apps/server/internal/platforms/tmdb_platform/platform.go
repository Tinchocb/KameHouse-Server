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

func (p *Platform) GetAnime(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	res, err := p.tmdbClient.GetTVDetails(ctx, strconv.Itoa(mediaID))
	if err != nil {
		return nil, err
	}
	return p.toUnifiedMedia(&res, platform.MediaFormatTv), nil
}

func (p *Platform) GetAnimeWithRelations(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	return p.GetAnime(ctx, mediaID)
}

func (p *Platform) GetAnimeDetails(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	return p.GetAnime(ctx, mediaID)
}

func (p *Platform) GetCompleteAnime(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	return p.GetAnime(ctx, mediaID)
}

func (p *Platform) GetAnimeCollection(ctx context.Context, userName *string) (*platform.UnifiedCollection, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) GetAnimeCollectionWithRelations(ctx context.Context, userName *string) (*platform.UnifiedCollection, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) AddMediaToCollection(ctx context.Context, mediaIDs []int) error {
	return nil
}

func (p *Platform) GetManga(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	return nil, fmt.Errorf("TMDB platform: Manga not supported")
}

func (p *Platform) GetMangaDetails(ctx context.Context, mediaID int) (*platform.UnifiedMedia, error) {
	return nil, fmt.Errorf("TMDB platform: Manga not supported")
}

func (p *Platform) GetMangaCollection(ctx context.Context, userName *string) (*platform.UnifiedCollection, error) {
	return &platform.UnifiedCollection{}, nil
}

func (p *Platform) SearchAnimeByIds(ctx context.Context, ids []int, page *int, perPage *int, status []platform.MediaStatus, inCollection *bool, sort []platform.MediaSort, season *platform.MediaSeason, year *int, genre *string, format *platform.MediaFormat) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) ListAnime(ctx context.Context, page *int, search *string, perPage *int, sort []platform.MediaSort, status []platform.MediaStatus, genres []string, averageScoreGreater *int, season *platform.MediaSeason, seasonYear *int, format *platform.MediaFormat, isAdult *bool) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) ListRecentAnime(ctx context.Context, page *int, perPage *int, airingAtGreater *int, airingAtLesser *int, notYetAired *bool) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) SearchManga(ctx context.Context, page *int, perPage *int, sort []platform.MediaSort, search *string, status []platform.MediaStatus) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) ListManga(ctx context.Context, page *int, search *string, perPage *int, sort []platform.MediaSort, status []platform.MediaStatus, genres []string, averageScoreGreater *int, startDateGreater *string, startDateLesser *string, format *platform.MediaFormat, countryOfOrigin *string, isAdult *bool) (*platform.UnifiedMediaList, error) {
	return &platform.UnifiedMediaList{}, nil
}

func (p *Platform) GetViewer(ctx context.Context) (*platform.UnifiedViewer, error) {
	return &platform.UnifiedViewer{Name: p.username}, nil
}

func (p *Platform) GetViewerStats(ctx context.Context) (*platform.UnifiedViewerStats, error) {
	return &platform.UnifiedViewerStats{}, nil
}

func (p *Platform) GetStudioDetails(ctx context.Context, studioID int) (*platform.UnifiedStudioDetails, error) {
	return &platform.UnifiedStudioDetails{}, nil
}

func (p *Platform) GetAnimeAiringSchedule(ctx context.Context, ids []int, season *platform.MediaSeason, seasonYear *int, previousSeason *platform.MediaSeason, previousSeasonYear *int, nextSeason *platform.MediaSeason, nextSeasonYear *int) (*platform.UnifiedAiringSchedule, error) {
	return &platform.UnifiedAiringSchedule{}, nil
}

func (p *Platform) GetAnimeAiringScheduleRaw(ctx context.Context, ids []int) (interface{}, error) {
	return nil, nil
}

func (p *Platform) UpdateMediaListEntry(ctx context.Context, mediaID int, status *platform.MediaListStatus, scoreRaw *int, progress *int, startedAt *platform.FuzzyDateInput, completedAt *platform.FuzzyDateInput) (*platform.UnifiedMediaListEntry, error) {
	return nil, nil
}

func (p *Platform) UpdateMediaListEntryProgress(ctx context.Context, mediaID int, progress *int, status *platform.MediaListStatus) (*platform.UnifiedMediaListEntry, error) {
	return nil, nil
}

func (p *Platform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return nil
}

func (p *Platform) UpdateMediaListEntryRepeat(ctx context.Context, mediaID int, repeat *int) (*platform.UnifiedMediaListEntry, error) {
	return nil, nil
}

func (p *Platform) DeleteEntry(ctx context.Context, mediaListEntryID int) (*platform.UnifiedMediaListEntry, error) {
	return nil, nil
}

func (p *Platform) ClearCache() {}
func (p *Platform) Close()      {}

func (p *Platform) toUnifiedMedia(res *tmdb.SearchResult, format platform.MediaFormat) *platform.UnifiedMedia {
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
		p := "https://image.tmdb.org/t/p/original" + res.PosterPath
		poster = &p
	}
	if res.BackdropPath != "" {
		b := "https://image.tmdb.org/t/p/original" + res.BackdropPath
		backdrop = &b
	}

	m := &platform.UnifiedMedia{
		ID:     res.ID,
		Type:   platform.MediaType("ANIME"), // We'll treat Animation as Anime
		Format: format,
		Title:  title,
		CoverImage: &platform.MediaCoverImage{
			ExtraLarge: poster,
			Large:      poster,
		},
		BannerImage: backdrop,
	}

	// Dates
	if res.FirstAirDate != "" {
		m.StartDate = p.parseDate(res.FirstAirDate)
	} else if res.ReleaseDate != "" {
		m.StartDate = p.parseDate(res.ReleaseDate)
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
