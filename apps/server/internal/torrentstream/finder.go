package torrentstream

import (
	"fmt"
	"kamehouse/internal/api/anilist"

	"github.com/anacrolix/torrent"
)

var (
	ErrNoTorrentsFound = fmt.Errorf("no torrents found, please select manually")
	ErrNoEpisodeFound  = fmt.Errorf("could not select episode from torrents, please select manually")
)

type (
	playbackTorrent struct {
		Torrent *torrent.Torrent
		File    *torrent.File
	}
)

func (r *Repository) findBestTorrent(media *anilist.CompleteAnime, aniDbEpisode string, episodeNumber int) (ret *playbackTorrent, err error) {
	return nil, nil
}

func (r *Repository) findBestTorrentFromManualSelection(t interface{}, media *anilist.CompleteAnime, aniDbEpisode string, chosenFileIndex *int) (*playbackTorrent, error) {
	return nil, nil
}
