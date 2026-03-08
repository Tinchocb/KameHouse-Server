package models

import "kamehouse/internal/api/anilist"

func (m *LibraryMedia) ToAnilistBaseAnime() *anilist.BaseAnime {
	if m == nil {
		return nil
	}

	format := anilist.MediaFormat(m.Format)
	status := anilist.MediaStatus(m.Status)

	titleNative := m.TitleOriginal
	titleRomaji := m.TitleRomaji
	titleEnglish := m.TitleEnglish

	title := &anilist.BaseAnime_Title{
		Native:  &titleNative,
		Romaji:  &titleRomaji,
		English: &titleEnglish,
	}

	var coverImage string
	if m.PosterImage != "" {
		coverImage = m.PosterImage
	}

	var bannerImage string
	if m.BannerImage != "" {
		bannerImage = m.BannerImage
	}

	mediaType := anilist.MediaType(m.Type)

	return &anilist.BaseAnime{
		ID:          int(m.ID),
		Type:        &mediaType,
		Format:      &format,
		Status:      &status,
		Title:       title,
		Episodes:    m.Episodes(),
		CoverImage:  &anilist.BaseAnime_CoverImage{ExtraLarge: &coverImage, Large: &coverImage},
		BannerImage: &bannerImage,
	}
}

// ToLibraryMedia is a temporary compat function to map anilist.BaseAnime to LibraryMedia
func ToLibraryMedia(a *anilist.BaseAnime) *LibraryMedia {
	if a == nil {
		return nil
	}

	format := ""
	if a.GetFormat() != nil {
		format = string(*a.GetFormat())
	}

	status := ""
	if a.GetStatus() != nil {
		status = string(*a.GetStatus())
	}

	titleOriginal := ""
	if a.GetTitle() != nil && a.GetTitle().GetNative() != nil {
		titleOriginal = *a.GetTitle().GetNative()
	}
	titleRomaji := ""
	if a.GetTitle() != nil && a.GetTitle().GetRomaji() != nil {
		titleRomaji = *a.GetTitle().GetRomaji()
	}
	titleEnglish := ""
	if a.GetTitle() != nil && a.GetTitle().GetEnglish() != nil {
		titleEnglish = *a.GetTitle().GetEnglish()
	}

	return &LibraryMedia{
		BaseModel: BaseModel{
			ID: uint(a.ID),
		},
		Type:          "ANIME",
		Format:        format,
		Status:        status,
		TitleOriginal: titleOriginal,
		TitleRomaji:   titleRomaji,
		TitleEnglish:  titleEnglish,
		PosterImage:   a.GetCoverImageSafe(),
		BannerImage:   a.GetBannerImageSafe(),
	}
}

func ToMediaEntryListData(e *anilist.AnimeListEntry) *MediaEntryListData {
	if e == nil {
		return nil
	}

	status := ""
	if e.GetStatus() != nil {
		status = string(*e.GetStatus())
	}

	score := 0.0
	if e.GetScore() != nil {
		score = *e.GetScore()
	}
	repeat := 0
	if e.GetRepeat() != nil {
		repeat = *e.GetRepeat()
	}
	progress := 0
	if e.Progress != nil {
		progress = *e.Progress
	}

	return &MediaEntryListData{
		BaseModel: BaseModel{
			ID: uint(e.ID),
		},
		LibraryMediaID: uint(e.Media.ID),
		LibraryMedia:   ToLibraryMedia(e.Media),
		Status:         status,
		Progress:       progress,
		Score:          score,
		Repeat:         repeat,
		StartedAt:      "",
		CompletedAt:    "",
	}
}
