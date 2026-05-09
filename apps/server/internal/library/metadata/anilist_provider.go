package metadata

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"kamehouse/internal/database/models/dto"
)

type AniListProvider struct {
	client *http.Client
}

func NewAniListProvider() *AniListProvider {
	return &AniListProvider{
		client: &http.Client{},
	}
}

func (p *AniListProvider) GetProviderID() string {
	return "anilist"
}

func (p *AniListProvider) GetName() string {
	return "AniList"
}

const anilistGraphqlEndpoint = "https://graphql.anilist.co"

const anilistMediaQuery = `
	id
	title {
		romaji
		english
		native
		userPreferred
	}
	synonyms
	format
	status
	season
	episodes
	description
	startDate {
		year
		month
		day
	}
	coverImage {
		extraLarge
	}
	bannerImage
	relations {
		edges {
			relationType
			node {
				id
				type
				format
				status
				episodes
				season
				title {
					romaji
					english
					native
					userPreferred
				}
				synonyms
			}
		}
	}
	nextAiringEpisode {
		episode
	}
`

type anilistResponse struct {
	Data struct {
		Page struct {
			Media []anilistMedia `json:"media"`
		} `json:"Page"`
		Media anilistMedia `json:"Media"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

type anilistMedia struct {
	ID    int `json:"id"`
	Title struct {
		Romaji        string `json:"romaji"`
		English       string `json:"english"`
		Native        string `json:"native"`
		UserPreferred string `json:"userPreferred"`
	} `json:"title"`
	Synonyms    []string `json:"synonyms"`
	Format      string   `json:"format"`
	Status      string   `json:"status"`
	Season      string   `json:"season"`
	Episodes    int      `json:"episodes"`
	Description string   `json:"description"`
	StartDate   struct {
		Year  int `json:"year"`
		Month int `json:"month"`
		Day   int `json:"day"`
	} `json:"startDate"`
	CoverImage struct {
		ExtraLarge string `json:"extraLarge"`
	} `json:"coverImage"`
	BannerImage string `json:"bannerImage"`
	Relations   *struct {
		Edges []struct {
			RelationType string       `json:"relationType"`
			Node         anilistMedia `json:"node"`
		} `json:"edges"`
	} `json:"relations"`
	NextAiringEpisode *struct {
		Episode int `json:"episode"`
	} `json:"nextAiringEpisode"`
}

func (p *AniListProvider) SearchMedia(ctx context.Context, query string) ([]*dto.NormalizedMedia, error) {
	q := `
	query ($search: String) {
		Page(page: 1, perPage: 10) {
			media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
				` + anilistMediaQuery + `
			}
		}
	}`

	variables := map[string]interface{}{
		"search": query,
	}

	res, err := p.doGraphQL(ctx, q, variables)
	if err != nil {
		return nil, err
	}

	if len(res.Data.Page.Media) == 0 {
		return nil, ErrNotFound
	}

	var results []*dto.NormalizedMedia
	for _, m := range res.Data.Page.Media {
		results = append(results, p.toNormalizedMedia(m))
	}

	return results, nil
}

func (p *AniListProvider) GetMediaDetails(ctx context.Context, id string) (*dto.NormalizedMedia, error) {
	numID, err := strconv.Atoi(id)
	if err != nil {
		return nil, fmt.Errorf("invalid AniList ID: %w", err)
	}

	q := `
	query ($id: Int) {
		Media(id: $id, type: ANIME) {
			` + anilistMediaQuery + `
		}
	}`

	variables := map[string]interface{}{
		"id": numID,
	}

	res, err := p.doGraphQL(ctx, q, variables)
	if err != nil {
		return nil, err
	}

	if res.Data.Media.ID == 0 {
		return nil, ErrNotFound
	}

	return p.toNormalizedMedia(res.Data.Media), nil
}

func (p *AniListProvider) doGraphQL(ctx context.Context, query string, variables map[string]interface{}) (*anilistResponse, error) {
	payload := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anilistGraphqlEndpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, ErrRateLimit
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anilist api error %d: %s", resp.StatusCode, string(body))
	}

	var res anilistResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	if len(res.Errors) > 0 {
		if strings.Contains(strings.ToLower(res.Errors[0].Message), "not found") {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("anilist graphql error: %s", res.Errors[0].Message)
	}

	return &res, nil
}

func (p *AniListProvider) toNormalizedMedia(m anilistMedia) *dto.NormalizedMedia {
	title := &dto.NormalizedMediaTitle{}
	if m.Title.English != "" {
		title.English = &m.Title.English
	}
	if m.Title.Romaji != "" {
		title.Romaji = &m.Title.Romaji
	}
	if m.Title.Native != "" {
		title.Native = &m.Title.Native
	}
	if m.Title.UserPreferred != "" {
		title.UserPreferred = &m.Title.UserPreferred
	}

	var synonyms []*string
	for _, syn := range m.Synonyms {
		s := syn
		synonyms = append(synonyms, &s)
	}

	var format *dto.MediaFormat
	if m.Format != "" {
		f := dto.MediaFormat(m.Format)
		format = &f
	}

	var year *int
	if m.StartDate.Year > 0 {
		y := m.StartDate.Year
		year = &y
	}

	var startDate *dto.NormalizedMediaDate
	if m.StartDate.Year > 0 {
		startDate = &dto.NormalizedMediaDate{
			Year:  &m.StartDate.Year,
			Month: &m.StartDate.Month,
			Day:   &m.StartDate.Day,
		}
	}

	var episodes *int
	if m.Episodes > 0 {
		ep := m.Episodes
		episodes = &ep
	}

	var coverImage *dto.NormalizedMediaCoverImage
	if m.CoverImage.ExtraLarge != "" {
		coverImage = &dto.NormalizedMediaCoverImage{
			Large:      &m.CoverImage.ExtraLarge,
			ExtraLarge: &m.CoverImage.ExtraLarge,
		}
	}

	var bannerImage *string
	if m.BannerImage != "" {
		bannerImage = &m.BannerImage
	}

	var description *string
	if m.Description != "" {
		description = &m.Description
	}

	var season *dto.MediaSeason
	if m.Season != "" {
		s := dto.MediaSeason(m.Season)
		season = &s
	}

	var nextAiring *dto.NormalizedMediaNextAiringEpisode
	if m.NextAiringEpisode != nil {
		nextAiring = &dto.NormalizedMediaNextAiringEpisode{
			Episode: m.NextAiringEpisode.Episode,
		}
	}

	var relations []*dto.NormalizedMediaRelation
	if m.Relations != nil {
		for _, edge := range m.Relations.Edges {
			// Avoid infinite recursion by not populating relations of relations
			nodeMedia := p.toNormalizedMediaShallow(edge.Node)
			relations = append(relations, &dto.NormalizedMediaRelation{
				RelationType: edge.RelationType,
				Media:        nodeMedia,
			})
		}
	}

	return &dto.NormalizedMedia{
		ID:                m.ID,
		ExplicitProvider:  "anilist",
		ExplicitID:        strconv.Itoa(m.ID),
		Title:             title,
		Synonyms:          synonyms,
		Format:            format,
		Status:            (*dto.MediaStatus)(&m.Status),
		Season:            season,
		Year:              year,
		StartDate:         startDate,
		Episodes:          episodes,
		CoverImage:        coverImage,
		BannerImage:       bannerImage,
		Description:       description,
		NextAiringEpisode: nextAiring,
		Relations:         relations,
	}
}

// toNormalizedMediaShallow converts anilistMedia without resolving its relations, avoiding infinite loops.
func (p *AniListProvider) toNormalizedMediaShallow(m anilistMedia) *dto.NormalizedMedia {
	nm := p.toNormalizedMedia(anilistMedia{
		ID:          m.ID,
		Title:       m.Title,
		Synonyms:    m.Synonyms,
		Format:      m.Format,
		Status:      m.Status,
		Season:      m.Season,
		Episodes:    m.Episodes,
		Description: m.Description,
		StartDate:   m.StartDate,
		CoverImage:  m.CoverImage,
		BannerImage: m.BannerImage,
		// Omit relations and nextAiringEpisode
	})
	return nm
}
