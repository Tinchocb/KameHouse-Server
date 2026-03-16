package autodownloader

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/hook_resolver"
	"kamehouse/internal/library/anime"
)

// AutoDownloaderRunStartedEvent is triggered when the autodownloader starts checking for new episodes.
// Prevent default to abort the run.
type AutoDownloaderRunStartedEvent struct {
	hook_resolver.Event
	Rules    []*dto.AutoDownloaderRule    `json:"rules"`
	Profiles []*dto.AutoDownloaderProfile `json:"profiles"`
}

// AutoDownloaderTorrentsFetchedEvent is triggered at the beginning of a run, when the autodownloader fetches torrents from the provider.
type AutoDownloaderTorrentsFetchedEvent struct {
	hook_resolver.Event
	Torrents []*NormalizedTorrent `json:"torrents"`
}

// AutoDownloaderMatchVerifiedEvent is triggered when a torrent is verified to follow a rule.
// Prevent default to abort the download if the match is found.
type AutoDownloaderMatchVerifiedEvent struct {
	hook_resolver.Event
	// Fetched torrent
	Torrent    *NormalizedTorrent           `json:"torrent"`
	Rule       *dto.AutoDownloaderRule      `json:"rule"`
	ListEntry  interface{}                  `json:"listEntry"`
	LocalEntry *anime.LocalFileWrapperEntry `json:"localEntry"`
	// The episode number found for the match
	// If the match failed, this will be 0
	Episode int `json:"episode"`
	// Whether the torrent matches the rule
	// Changing this value to true will trigger a download even if the match failed;
	MatchFound bool `json:"matchFound"`
}

// AutoDownloaderSettingsUpdatedEvent is triggered when the autodownloader settings are updated
type AutoDownloaderSettingsUpdatedEvent struct {
	hook_resolver.Event
	Settings *models.AutoDownloaderSettings `json:"settings"`
}

// AutoDownloaderBeforeDownloadTorrentEvent is triggered when the autodownloader is about to download a torrent.
// Prevent default to abort the download.
type AutoDownloaderBeforeDownloadTorrentEvent struct {
	hook_resolver.Event
	Torrent *NormalizedTorrent           `json:"torrent"`
	Rule    *dto.AutoDownloaderRule      `json:"rule"`
	Items   []*models.AutoDownloaderItem `json:"items"`
}

// AutoDownloaderAfterDownloadTorrentEvent is triggered when the autodownloader has downloaded a torrent.
type AutoDownloaderAfterDownloadTorrentEvent struct {
	hook_resolver.Event
	Torrent *NormalizedTorrent      `json:"torrent"`
	Rule    *dto.AutoDownloaderRule `json:"rule"`
}
