package torrentstream

import (
	"fmt"
	"os"
	"path/filepath"

	atorrent "github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/storage"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
)

type Client struct {
	repository     *Repository
	logger         *zerolog.Logger
	client         *atorrent.Client
	currentFile    mo.Option[*atorrent.File]
	currentTorrent mo.Option[*atorrent.Torrent]
	currentTorrentStatus TorrentStatus
	cacheDir       string
}

func NewClient(r *Repository) *Client {
	return &Client{
		repository: r,
		logger:     r.logger,
	}
}

// initializeClient creates and configures the anacrolix/torrent client.
// It uses settings from the repository to configure caching, IPv6, and seeding behavior.
func (c *Client) initializeClient() error {
	settings, ok := c.repository.settings.Get()
	if !ok {
		return fmt.Errorf("torrentstream: no settings available")
	}

	// Determine cache directory
	cacheDir := settings.CachePath
	if cacheDir == "" {
		cacheDir = filepath.Join(os.TempDir(), "kamehouse", "torrentstream")
	}
	c.cacheDir = cacheDir

	// Ensure cache directory exists
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return fmt.Errorf("torrentstream: failed to create cache directory %s: %w", cacheDir, err)
	}

	cfg := atorrent.NewDefaultClientConfig()

	// Use file-based storage organized by info hash for isolation
	cfg.DefaultStorage = storage.NewFileByInfoHash(cacheDir)

	// Network settings
	cfg.DisableIPv6 = settings.DisableIPV6

	// Seeding behavior
	if settings.SlowSeeding {
		cfg.NoUpload = true
		cfg.Seed = false
	} else {
		cfg.NoUpload = false
		cfg.Seed = true
	}

	// Use a fixed listening port from settings, or let it auto-select
	if settings.TorrentClientPort > 0 {
		cfg.ListenPort = settings.TorrentClientPort
	}

	// Create the client
	client, err := atorrent.NewClient(cfg)
	if err != nil {
		return fmt.Errorf("torrentstream: failed to create torrent client: %w", err)
	}

	c.client = client
	c.logger.Info().
		Str("cacheDir", cacheDir).
		Bool("disableIPv6", settings.DisableIPV6).
		Bool("slowSeeding", settings.SlowSeeding).
		Msg("torrentstream: Torrent client initialized")

	return nil
}

// Shutdown gracefully closes the torrent client and cleans up resources.
func (c *Client) Shutdown() {
	if c.client == nil {
		return
	}

	c.logger.Info().Msg("torrentstream: Shutting down torrent client")

	// Drop all active torrents first
	c.dropTorrents()

	// Close the client
	c.client.Close()
	c.client = nil

	c.logger.Info().Msg("torrentstream: Torrent client shut down")
}

// readyToStream checks if the client is initialized and has a current file with data.
func (c *Client) readyToStream() bool {
	if c.client == nil {
		return false
	}

	file, ok := c.currentFile.Get()
	if !ok || file == nil {
		return false
	}

	torr, ok := c.currentTorrent.Get()
	if !ok || torr == nil {
		return false
	}

	// Check if we have torrent info (metadata resolved)
	if torr.Info() == nil {
		return false
	}

	return true
}

// GetStreamingUrl returns the URL for the built-in web player to use.
func (c *Client) GetStreamingUrl() string {
	if !c.readyToStream() {
		return ""
	}
	return "/api/v1/directstream/stream"
}

// GetExternalPlayerStreamingUrl returns the URL for external players (VLC, MPV, etc).
func (c *Client) GetExternalPlayerStreamingUrl() string {
	settings, ok := c.repository.settings.Get()
	if !ok {
		return ""
	}

	if !c.readyToStream() {
		return ""
	}

	// Use the configured stream URL address or default to localhost
	host := settings.StreamUrlAddress
	if host == "" {
		host = "http://127.0.0.1"
	}

	port := settings.StreamingServerPort
	if port == 0 {
		port = 43214
	}

	return fmt.Sprintf("%s:%d/api/v1/directstream/stream", host, port)
}

// dropTorrents removes all active torrents from the client,
// clearing current state and optionally cleaning up downloaded files.
func (c *Client) dropTorrents() {
	if c.client == nil {
		return
	}

	c.logger.Debug().Msg("torrentstream: Dropping all active torrents")

	// Clear current state
	c.currentFile = mo.None[*atorrent.File]()
	c.currentTorrent = mo.None[*atorrent.Torrent]()

	// Drop all torrents
	for _, t := range c.client.Torrents() {
		infoHash := t.InfoHash().String()
		t.Drop()
		c.logger.Debug().Str("hash", infoHash).Msg("torrentstream: Dropped torrent")

		// Clean up the torrent's data directory
		torrentDir := filepath.Join(c.cacheDir, infoHash)
		if err := os.RemoveAll(torrentDir); err != nil {
			c.logger.Warn().Err(err).Str("dir", torrentDir).Msg("torrentstream: Failed to clean up torrent directory")
		}
	}
}

// cleanupCache enforces the cache size limit from settings.
// It removes the oldest torrent data directories when the total exceeds CacheLimitGB.
func (c *Client) cleanupCache() {
	settings, ok := c.repository.settings.Get()
	if !ok || settings.CacheLimitGB <= 0 {
		return
	}

	limitBytes := int64(settings.CacheLimitGB) * 1024 * 1024 * 1024

	// Calculate current total cache size
	var totalSize int64
	entries, err := os.ReadDir(c.cacheDir)
	if err != nil {
		c.logger.Warn().Err(err).Msg("torrentstream: Failed to read cache directory for cleanup")
		return
	}

	type dirEntry struct {
		path    string
		size    int64
		modTime int64
	}
	var dirs []dirEntry

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dirPath := filepath.Join(c.cacheDir, entry.Name())
		size := dirSize(dirPath)
		info, _ := entry.Info()
		modTime := int64(0)
		if info != nil {
			modTime = info.ModTime().Unix()
		}
		totalSize += size
		dirs = append(dirs, dirEntry{path: dirPath, size: size, modTime: modTime})
	}

	if totalSize <= limitBytes {
		return
	}

	c.logger.Info().
		Int64("totalMB", totalSize/1024/1024).
		Int("limitGB", settings.CacheLimitGB).
		Msg("torrentstream: Cache exceeds limit, cleaning up")

	// Sort by modification time (oldest first) — simple bubble sort for small N
	for i := 0; i < len(dirs); i++ {
		for j := i + 1; j < len(dirs); j++ {
			if dirs[i].modTime > dirs[j].modTime {
				dirs[i], dirs[j] = dirs[j], dirs[i]
			}
		}
	}

	// Remove oldest directories until we're under the limit
	for _, d := range dirs {
		if totalSize <= limitBytes {
			break
		}
		if err := os.RemoveAll(d.path); err != nil {
			c.logger.Warn().Err(err).Str("path", d.path).Msg("torrentstream: Failed to remove old cache directory")
			continue
		}
		totalSize -= d.size
		c.logger.Debug().Str("path", d.path).Int64("freedMB", d.size/1024/1024).Msg("torrentstream: Removed old cache directory")
	}
}

// dirSize calculates the total size of all files in a directory recursively.
func dirSize(path string) int64 {
	var size int64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}
