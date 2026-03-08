package anidb

import (
	"context"
	"fmt"
	"time"

	"go.felesatra.moe/anidb"

	"github.com/rs/zerolog"
)

type Client struct {
	client   *anidb.Client
	logger   *zerolog.Logger
	username string
	password string
}

type AnimeInfo struct {
	ID             int
	Title          string
	TitleJapanese  string
	TitleRomaji    string
	Type           string
	Episodes       int
	StartDate      time.Time
	EndDate        time.Time
	Summary        string
	Image          string
	Genres         []string
	EpisodesDetail []EpisodeInfo
}

type EpisodeInfo struct {
	Number        int
	Title         string
	TitleJapanese string
	AirDate       time.Time
	Rating        float64
}

type SearchResult struct {
	ID         int
	Title      string
	TitleShort string
	Type       string
	Episodes   int
}

func NewClient(username, password string, logger *zerolog.Logger) *Client {
	client := &anidb.Client{
		Name:    "kamehouse",
		Version: 1,
	}

	return &Client{
		client:   client,
		logger:   logger,
		username: username,
		password: password,
	}
}

func (c *Client) GetAnime(ctx context.Context, aid int) (*AnimeInfo, error) {
	anime, err := c.client.RequestAnime(aid)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch anime %d: %w", aid, err)
	}

	return c.convertAnime(anime), nil
}

func (c *Client) SearchByTitle(ctx context.Context, title string) ([]SearchResult, error) {
	c.logger.Debug().Str("title", title).Msg("anidb: searching by title is not implemented, use GetAnimeByTitle")
	return nil, fmt.Errorf("search by title not implemented, use GetAnimeByTitle with exact name")
}

func (c *Client) GetAnimeByTitle(ctx context.Context, title string) (*AnimeInfo, error) {
	c.logger.Debug().Str("title", title).Msg("anidb: get anime by title not implemented")
	return nil, fmt.Errorf("get anime by title not implemented")
}

func (c *Client) convertAnime(a *anidb.Anime) *AnimeInfo {
	info := &AnimeInfo{
		ID:       a.AID,
		Type:     a.Type,
		Episodes: a.EpisodeCount,
	}

	for _, t := range a.Titles {
		switch t.Lang {
		case "en":
			info.Title = t.Name
		case "ja":
			info.TitleJapanese = t.Name
		case "x-jat":
			info.TitleRomaji = t.Name
		}
	}

	if info.Title == "" && len(a.Titles) > 0 {
		info.Title = a.Titles[0].Name
	}

	if a.StartDate != "" {
		info.StartDate, _ = time.Parse("2006-01-02", a.StartDate)
	}

	if a.EndDate != "" {
		info.EndDate, _ = time.Parse("2006-01-02", a.EndDate)
	}

	for _, ep := range a.Episodes {
		epNum := parseEpisodeNumber(ep.EpNo)
		rating := 0.0
		info.EpisodesDetail = append(info.EpisodesDetail, EpisodeInfo{
			Number:        epNum,
			Title:         getFirstEpTitle(ep.Titles),
			TitleJapanese: getFirstEpTitleJP(ep.Titles),
			Rating:        rating,
		})
	}

	return info
}

func parseEpisodeNumber(epno string) int {
	num := 0
	for _, c := range epno {
		if c >= '0' && c <= '9' {
			num = num*10 + int(c-'0')
		}
	}
	return num
}

func getFirstEpTitle(titles []anidb.EpTitle) string {
	for _, t := range titles {
		if t.Lang == "en" {
			return t.Title
		}
	}
	if len(titles) > 0 {
		return titles[0].Title
	}
	return ""
}

func getFirstEpTitleJP(titles []anidb.EpTitle) string {
	for _, t := range titles {
		if t.Lang == "ja" {
			return t.Title
		}
	}
	return ""
}
