package debrid_client

import (
	"fmt"
	"kamehouse/internal/debrid/debrid"
	"kamehouse/internal/platforms/platform"
)

type (
	playbackTorrent struct {
		torrent  interface{}
		fileId   string
		filepath string
	}
)

func (r *Repository) InitModules(args ...interface{}) error { return nil }
func (r *Repository) Shutdown(args ...interface{}) error { return nil }

func (r *Repository) findBestTorrent(provider debrid.Provider, media *platform.UnifiedMedia, episodeNumber int) (ret *playbackTorrent, err error) {
	// Auto-select deactivated during cleanup
	return nil, fmt.Errorf("auto-select is disabled")
}

func (r *Repository) findBestTorrentFromManualSelection(provider debrid.Provider, t interface{}, media *platform.UnifiedMedia, episodeNumber int, chosenFileIndex *int) (ret *playbackTorrent, err error) {
	// Manual selection stubbed for cleanup
	return nil, fmt.Errorf("manual selection is disabled")
}
