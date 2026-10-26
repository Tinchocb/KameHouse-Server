package jikan_platform

import (
	"context"

	"kamehouse/internal/api/jikan"
	"kamehouse/internal/platforms/platform"

	"github.com/rs/zerolog"
)

type Platform struct {
	jikanClient *jikan.Client
}

func NewPlatform(logger *zerolog.Logger) *Platform {
	return &Platform{
		jikanClient: jikan.NewClient(logger),
	}
}

func (p *Platform) GetAnime(ctx context.Context, mediaID int) (interface{}, error) {
	res, err := p.jikanClient.GetAnimeFull(ctx, mediaID)
	if err != nil {
		return nil, err
	}

	title := res.Data.TitleEng
	if title == "" {
		title = res.Data.Title
	}
	native := res.Data.TitleJpn
	poster := res.Data.Images.Jpg.LargeImageUrl
	synopsis := res.Data.Synopsis

	m := &platform.UnifiedMedia{
		ID:     res.Data.MalID,
		Type:   platform.MediaType("ANIME"),
		Format: platform.MediaFormatTv,
		Kind:   platform.MediaKindAnime,
		Title: &platform.MediaTitle{
			Romaji: &title,
			Native: &native,
		},
		CoverImage: &platform.MediaCoverImage{
			ExtraLarge: &poster,
			Large:      &poster,
		},
		Overview: &synopsis,
	}

	return m, nil
}

func (p *Platform) UpdateEntryProgress(ctx context.Context, mediaID int, progress int, totalEpisodes *int) error {
	return nil
}
func (p *Platform) GetAnimeCollection(ctx context.Context, bypassCache bool) (interface{}, error) {
	return &platform.UnifiedCollection{}, nil
}
func (p *Platform) AddMediaToCollection(ctx context.Context, mIds []int) error      { return nil }
func (p *Platform) RefreshAnimeCollection(ctx context.Context) (interface{}, error) { return nil, nil }

var _ platform.Platform = (*Platform)(nil)
