package streaming

import (
	"context"
	"kamehouse/internal/torrentstream"
)

// TorrentProvider resolves streams via torrent streaming.
// It wraps the existing torrentstream.Repository.
type TorrentProvider struct {
	repo *torrentstream.Repository
}

// NewTorrentProvider creates a new torrent stream provider.
func NewTorrentProvider(repo *torrentstream.Repository) *TorrentProvider {
	return &TorrentProvider{repo: repo}
}

func (p *TorrentProvider) Name() string { return "torrent" }

func (p *TorrentProvider) SupportsMedia(_ int) bool {
	// Torrent streaming is available if the repository is initialized
	return p.repo != nil
}

func (p *TorrentProvider) ResolveStream(ctx context.Context, req StreamRequest) (*StreamResult, error) {
	if p.repo == nil {
		return nil, ErrUnsupported
	}

	// The actual stream URL is managed by the torrent client within the repository.
	// This provider signals availability; the actual URL resolution happens
	// through the existing torrentstream API endpoints.
	return nil, ErrStreamNotReady
}
