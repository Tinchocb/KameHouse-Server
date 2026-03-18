package torrentstream

import (
	"context"
	"fmt"
	"kamehouse/internal/directstream"
	"kamehouse/internal/platforms/platform"
	"strconv"
)

type StartStreamOptions struct {
	Media         *platform.UnifiedMedia
	AniDbEpisode  string
	EpisodeNumber int
	Torrent       interface{}
	FileIndex     *int
	MagnetLink    string // The magnet link to stream from
	ClientId      string // Client ID for the player session
}

// StartStream resolves a magnet link into a playable torrent stream and bridges it
// to the directstream.Manager for HTTP-based playback.
func (r *Repository) StartStream(ctx context.Context, opts *StartStreamOptions) error {
	if opts == nil {
		return fmt.Errorf("torrentstream: StartStream called with nil options")
	}

	r.mu.Lock()
	client := r.torrentClient
	dsManager := r.directStreamManager
	r.mu.Unlock()

	if client == nil || client.client == nil {
		return fmt.Errorf("torrentstream: client not initialized — is the module enabled?")
	}

	if dsManager == nil {
		return fmt.Errorf("torrentstream: directstream manager not available")
	}

	if opts.MagnetLink == "" {
		return fmt.Errorf("torrentstream: no magnet link provided")
	}

	// Send loading state event
	r.sendStateEvent(eventLoading, TLSStateSearchingTorrents)

	// 1. Drop any existing torrents (clean slate)
	client.dropTorrents()

	// 2. Add magnet, wait for metadata, select best video file
	r.logger.Info().Msg("torrentstream: Resolving magnet link...")
	r.sendStateEvent(eventLoading, TLSStateSearchingTorrents)

	pt, err := r.findBestTorrentFromMagnet(opts.MagnetLink)
	if err != nil {
		r.sendStateEvent(eventLoadingFailed, "")
		return fmt.Errorf("torrentstream: failed to resolve magnet: %w", err)
	}

	r.logger.Info().
		Str("file", pt.File.DisplayPath()).
		Int64("sizeMB", pt.File.Length()/1024/1024).
		Msg("torrentstream: Starting download for streaming")

	r.sendStateEvent(eventLoading, TLSStateDownloading)

	// 3. Bridge to directstream.Manager.PlayTorrentStream()
	// This creates a TorrentStream in the directstream system, which handles:
	// - HTTP Range Requests
	// - MKV metadata parsing
	// - Subtitle extraction
	// - Content type detection
	anidbEpisode := opts.AniDbEpisode
	if anidbEpisode == "" {
		anidbEpisode = strconv.Itoa(opts.EpisodeNumber)
	}

	clientId := opts.ClientId
	if clientId == "" {
		clientId = "torrentstream"
	}

	streamReadyCh, err := dsManager.PlayTorrentStream(ctx, directstream.PlayTorrentStreamOptions{
		ClientId:      clientId,
		EpisodeNumber: opts.EpisodeNumber,
		AnidbEpisode:  anidbEpisode,
		Media:         opts.Media,
		Torrent:       pt.Torrent,
		File:          pt.File,
		OnTerminate: func() {
			// This is called when the stream is terminated (user stops playback)
			r.logger.Info().Msg("torrentstream: Stream terminated, cleaning up")

			r.mu.Lock()
			c := r.torrentClient
			r.mu.Unlock()

			if c != nil {
				c.dropTorrents()
				c.cleanupCache()
			}

			r.sendStateEvent(eventTorrentStopped, "")
		},
	})
	if err != nil {
		r.sendStateEvent(eventLoadingFailed, "")
		return fmt.Errorf("torrentstream: failed to create stream: %w", err)
	}

	// 4. Signal that the stream is ready (close the channel)
	// The directstream system waits for this channel to be closed before loading the stream
	close(streamReadyCh)

	r.sendStateEvent(eventTorrentStartedPlaying, TLSStateReady)
	r.logger.Info().Msg("torrentstream: Stream is active and ready for playback")

	return nil
}
