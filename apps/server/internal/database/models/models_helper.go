package models

import (
	"kamehouse/internal/platforms/platform"
	"time"
)

func (s *Settings) GetMediaPlayer() *MediaPlayerSettings {
	if s == nil || s.MediaPlayer == nil {
		return &MediaPlayerSettings{}
	}
	return s.MediaPlayer
}

func (s *Settings) GetTorrent() *TorrentSettings {
	if s == nil || s.Torrent == nil {
		return &TorrentSettings{}
	}
	return s.Torrent
}


func (s *Settings) GetManga() *MangaSettings {
	if s == nil || s.Manga == nil {
		return &MangaSettings{}
	}
	return s.Manga
}

func (s *Settings) GetLibrary() *LibrarySettings {
	if s == nil || s.Library == nil {
		return &LibrarySettings{}
	}
	return s.Library
}

func (s *Settings) GetListSync() *ListSyncSettings {
	if s == nil || s.ListSync == nil {
		return &ListSyncSettings{}
	}
	return s.ListSync
}

func (s *Settings) GetAutoDownloader() *AutoDownloaderSettings {
	if s == nil || s.AutoDownloader == nil {
		return &AutoDownloaderSettings{}
	}
	return s.AutoDownloader
}


func (s *Settings) GetNotifications() *NotificationSettings {
	if s == nil || s.Notifications == nil {
		return &NotificationSettings{}
	}
	return s.Notifications
}

func (s *Settings) GetNakama() *NakamaSettings {
	if s == nil || s.Nakama == nil {
		return &NakamaSettings{}
	}
	return s.Nakama
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (s *Settings) GetSensitiveValues() []string {
	if s == nil {
		return []string{}
	}
	return []string{
		s.GetMediaPlayer().VlcPassword,
		s.GetTorrent().QBittorrentPassword,
		s.GetTorrent().TransmissionPassword,
		s.GetNakama().RemoteServerPassword,
		s.GetNakama().HostPassword,
		s.GetNakama().RemoteServerURL,
		s.GetNakama().Username,
	}
}

func (s *DebridSettings) GetSensitiveValues() []string {
	if s == nil || s.ApiKey == "" {
		return []string{}
	}
	return []string{
		s.ApiKey,
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func ToLibraryMedia(m *platform.UnifiedMedia) *LibraryMedia {
	if m == nil {
		return nil
	}
	lm := &LibraryMedia{
		BaseModel: BaseModel{
			ID: uint(m.ID),
		},
		Type:   string(m.Type),
		Format: string(m.Format),
		Status: string(m.Status),
	}
	if m.Title != nil {
		if m.Title.Romaji != nil {
			lm.TitleRomaji = *m.Title.Romaji
		}
		if m.Title.English != nil {
			lm.TitleEnglish = *m.Title.English
		}
		if m.Title.Native != nil {
			lm.TitleOriginal = *m.Title.Native
		}
	}
	if m.CoverImage != nil {
		lm.PosterImage = m.GetCoverImageSafe()
	}
	if m.BannerImage != nil {
		lm.BannerImage = *m.BannerImage
	}
	if m.Episodes != nil {
		lm.TotalEpisodes = *m.Episodes
	}
	if m.StartDate != nil {
		lm.StartDate = time.Date(
			loValue(m.StartDate.Year, 0),
			time.Month(loValue(m.StartDate.Month, 1)),
			loValue(m.StartDate.Day, 1),
			0, 0, 0, 0, time.UTC,
		)
		lm.Year = loValue(m.StartDate.Year, 0)
	}
	return lm
}

func ToMediaEntryListData(e *platform.UnifiedCollectionEntry) *MediaEntryListData {
	if e == nil {
		return nil
	}
	res := &MediaEntryListData{
		BaseModel: BaseModel{
			ID: uint(e.ID),
		},
		LibraryMediaID: uint(e.Media.ID),
		Status:         string(e.Status),
	}
	if e.Progress != nil {
		res.Progress = *e.Progress
	}
	if e.Score != nil {
		res.Score = *e.Score
	}
	if e.Repeat != nil {
		res.Repeat = *e.Repeat
	}
	return res
}

func loValue[T any](v *T, fallback T) T {
	if v == nil {
		return fallback
	}
	return *v
}
