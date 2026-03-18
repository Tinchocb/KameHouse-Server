package autodownloader

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/torrent_clients/torrent_client"
	"kamehouse/internal/util"
	"sync"

	hibiketorrent "kamehouse/internal/extension/hibike/torrent"

	"github.com/rs/zerolog"
)

type AutoDownloader struct {
	logger             *zerolog.Logger
	database           *db.Database
	wsEventManager     events.WSEventManagerInterface
	extensionBankRef   interface{}
	mu                 sync.Mutex
	running            bool
	settings           *models.AutoDownloaderSettings
	metadataProviderRef *util.Ref[metadata_provider.Provider]
}

func New(l *zerolog.Logger, d *db.Database, w events.WSEventManagerInterface) *AutoDownloader {
	return &AutoDownloader{logger: l, database: d, wsEventManager: w}
}

func (a *AutoDownloader) Start(ctx context.Context) {}
func (a *AutoDownloader) SetSettings(s models.AutoDownloaderSettings) {
	a.settings = &s
}
func (a *AutoDownloader) CleanUpDownloadedItems()                              {}
func (a *AutoDownloader) Run()                                                 {}
func (a *AutoDownloader) RunCheck(args ...interface{})                         {}
func (a *AutoDownloader) SetTorrentClientRepository(r interface{})             {}
func (a *AutoDownloader) GetSimulationResults() []*SimulationResult            { return nil }
func (a *AutoDownloader) ClearSimulationResults()                              {}
func (a *AutoDownloader) SetAnimeCollection(args ...interface{})               {}

// isTorrentAlreadyDownloaded checks if the torrent's info hash is already in the active torrent list.
func (a *AutoDownloader) isTorrentAlreadyDownloaded(t *NormalizedTorrent, existing []*torrent_client.Torrent) bool {
	hash := t.GetInfoHash()
	for _, e := range existing {
		if e.Hash == hash {
			return true
		}
	}
	return false
}

// isEpisodeAlreadyHandled returns true if the given episode is already in local files or in the download queue for this rule.
func (a *AutoDownloader) isEpisodeAlreadyHandled(
	episode, offset int,
	ruleID uint, mediaId int,
	lfw *anime.LocalFileWrapper,
	queuedItems []*models.AutoDownloaderItem,
) bool {
	// Calculate the effective episode number after applying offset
	effectiveEpisode := episode
	if offset > 0 {
		effectiveEpisode = episode - offset
	}

	// Check local files
	lfEntry, hasEntry := lfw.GetLocalEntryById(mediaId)
	if hasEntry {
		if _, found := lfEntry.FindLocalFileWithEpisodeNumber(effectiveEpisode); found {
			return true
		}
	}

	// Check queued items
	for _, item := range queuedItems {
		if item.MediaID != mediaId {
			continue
		}
		// Skip delayed items — they haven't been committed yet
		if item.IsDelayed {
			continue
		}
		// The queue stores the raw torrent episode number (before offset) for the same rule
		queueEpisode := item.Episode
		queueEffective := queueEpisode
		if offset > 0 {
			queueEffective = queueEpisode - offset
		}
		if queueEffective == effectiveEpisode && item.RuleID == ruleID {
			return true
		}
		// Also check if the queue item's raw episode number matches the effective episode (non-offset)
		if item.Episode == effectiveEpisode && item.RuleID == ruleID {
			return true
		}
	}

	return false
}

// isTitleMatch compares a torrent title against the autodownload rule.
// args: parsed (habari parsed), torrentName (string), rule (*dto.AutoDownloaderRule), entry (*models.MediaEntry)
func (a *AutoDownloader) isTitleMatch(args ...interface{}) bool { return false }

// isSeasonAndEpisodeMatch checks if the parsed torrent matches the expected season/episode for the rule.
// Returns (episodeNumber int, ok bool) as an interface slice.
func (a *AutoDownloader) isSeasonAndEpisodeMatch(args ...interface{}) (interface{}, bool) {
	return nil, false
}

// isAdditionalTermsMatch checks if a torrent name contains all required additional terms from the rule.
func (a *AutoDownloader) isAdditionalTermsMatch(args ...interface{}) bool { return false }

// selectAndDownloadTorrent is the main entry for running the download pipeline for an episode.
// (implementation in autodownloader_torrent.go)

// _ prevents unused import errors
var _ = hibiketorrent.AnimeTorrent{}
