package debrid_client

import (
	"fmt"
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/debrid/debrid"
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

func (r *Repository) findBestTorrent(provider debrid.Provider, media *anilist.CompleteAnime, episodeNumber int) (ret *playbackTorrent, err error) {
	// Auto-select deactivated during cleanup
	return nil, fmt.Errorf("auto-select is disabled")
}

func (r *Repository) findBestTorrentFromManualSelection(provider debrid.Provider, t interface{}, media *anilist.CompleteAnime, episodeNumber int, chosenFileIndex *int) (ret *playbackTorrent, err error) {
	// Manual selection stubbed for cleanup
	return nil, fmt.Errorf("manual selection is disabled")
}
