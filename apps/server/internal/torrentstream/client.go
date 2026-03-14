package torrentstream

import (
	atorrent "github.com/anacrolix/torrent"
	"github.com/samber/mo"
)

type Client struct {
	repository *Repository
	currentFile mo.Option[*atorrent.File]
	currentTorrent mo.Option[*atorrent.Torrent]
	currentTorrentStatus TorrentStatus
}

func NewClient(r *Repository) *Client {
	return &Client{repository: r}
}

func (c *Client) Shutdown() {}
func (c *Client) initializeClient() error { return nil }
func (c *Client) readyToStream() bool { return true }
func (c *Client) GetStreamingUrl() string { return "" }
func (c *Client) GetExternalPlayerStreamingUrl() string { return "" }
func (c *Client) dropTorrents() {}
