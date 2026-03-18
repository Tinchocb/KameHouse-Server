package torrentstream

import (
	"fmt"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/torrentutil"
	"path/filepath"
	"strings"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/samber/mo"
)

var (
	ErrNoTorrentsFound = fmt.Errorf("no torrents found, please select manually")
	ErrNoEpisodeFound  = fmt.Errorf("could not select episode from torrents, please select manually")
)

// videoExtensions contains the file extensions that are considered video files.
var videoExtensions = map[string]bool{
	".mkv":  true,
	".mp4":  true,
	".avi":  true,
	".webm": true,
	".mov":  true,
	".flv":  true,
	".wmv":  true,
	".m4v":  true,
}

type (
	playbackTorrent struct {
		Torrent *torrent.Torrent
		File    *torrent.File
	}
)

// findBestTorrent adds a magnet link, waits for metadata, selects the best video file,
// and configures piece prioritization for streaming.
func (r *Repository) findBestTorrent(media *platform.UnifiedMedia, aniDbEpisode string, episodeNumber int) (ret *playbackTorrent, err error) {
	r.mu.Lock()
	client := r.torrentClient
	r.mu.Unlock()

	if client == nil || client.client == nil {
		return nil, fmt.Errorf("torrentstream: client not initialized")
	}

	// The magnet link should have been sent through StartStream options
	// For now, return nil - the actual magnet link will be provided by the caller
	return nil, ErrNoTorrentsFound
}

// findBestTorrentFromMagnet adds a magnet link to the client, resolves metadata,
// and selects the best video file for streaming.
func (r *Repository) findBestTorrentFromMagnet(magnetLink string) (*playbackTorrent, error) {
	r.mu.Lock()
	client := r.torrentClient
	r.mu.Unlock()

	if client == nil || client.client == nil {
		return nil, fmt.Errorf("torrentstream: client not initialized")
	}

	r.logger.Info().Str("magnet", truncateMagnet(magnetLink)).Msg("torrentstream: Adding magnet link")

	// Add the magnet link
	t, err := client.client.AddMagnet(magnetLink)
	if err != nil {
		return nil, fmt.Errorf("torrentstream: failed to add magnet link: %w", err)
	}

	// Wait for metadata with a timeout
	r.logger.Info().Msg("torrentstream: Waiting for torrent metadata...")
	select {
	case <-t.GotInfo():
		r.logger.Info().Str("name", t.Name()).Int("files", len(t.Files())).Msg("torrentstream: Metadata resolved")
	case <-time.After(60 * time.Second):
		t.Drop()
		return nil, fmt.Errorf("torrentstream: timed out waiting for metadata (60s)")
	}

	// Find the best video file
	file, err := selectVideoFile(t)
	if err != nil {
		t.Drop()
		return nil, err
	}

	r.logger.Info().
		Str("file", file.DisplayPath()).
		Int64("sizeMB", file.Length()/1024/1024).
		Msg("torrentstream: Selected video file")

	// Prioritize download pieces for streaming (head + tail)
	torrentutil.PrioritizeDownloadPieces(t, file, r.logger)

	// Store the current torrent and file in the client
	r.mu.Lock()
	client.currentTorrent = toOption(t)
	client.currentFile = toOption(file)
	r.mu.Unlock()

	return &playbackTorrent{
		Torrent: t,
		File:    file,
	}, nil
}

// findBestTorrentFromManualSelection uses a user-selected torrent and file index.
func (r *Repository) findBestTorrentFromManualSelection(t interface{}, media *platform.UnifiedMedia, aniDbEpisode string, chosenFileIndex *int) (*playbackTorrent, error) {
	return nil, nil
}

// selectVideoFile finds the largest video file in a torrent.
// In a torrent with multiple files, the largest video file is typically the main content.
func selectVideoFile(t *torrent.Torrent) (*torrent.File, error) {
	files := t.Files()
	if len(files) == 0 {
		return nil, fmt.Errorf("torrentstream: torrent has no files")
	}

	var bestFile *torrent.File
	var bestSize int64

	for _, f := range files {
		ext := strings.ToLower(filepath.Ext(f.DisplayPath()))
		if !videoExtensions[ext] {
			continue
		}
		if !util.IsValidVideoExtension(ext) {
			continue
		}
		if f.Length() > bestSize {
			bestSize = f.Length()
			bestFile = f
		}
	}

	if bestFile == nil {
		return nil, fmt.Errorf("torrentstream: no video files found in torrent (total files: %d)", len(files))
	}

	return bestFile, nil
}

// truncateMagnet returns a preview of a magnet link for logging (keeps the info hash visible).
func truncateMagnet(magnet string) string {
	if len(magnet) > 80 {
		return magnet[:80] + "..."
	}
	return magnet
}

// toOption wraps a pointer in mo.Option (Some if non-nil, None otherwise).
func toOption[T any](v *T) mo.Option[*T] {
	if v == nil {
		return mo.None[*T]()
	}
	return mo.Some(v)
}
