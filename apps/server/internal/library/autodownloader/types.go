package autodownloader

import hibiketorrent "kamehouse/internal/extension/hibike/torrent"

// NormalizedTorrent is the autodownloader's unified representation of a torrent.
// AnimeTorrent carries the rich metadata from a hibike provider extension.
// The flat fields (Seeders, Size, Name, InfoHash) delegate to AnimeTorrent when set.
type NormalizedTorrent struct {
	InfoHash     string
	Seeders      int
	Size         int64
	Name         string
	AnimeTorrent *hibiketorrent.AnimeTorrent
}

func (t *NormalizedTorrent) GetInfoHash() string {
	if t.AnimeTorrent != nil && t.AnimeTorrent.InfoHash != "" {
		return t.AnimeTorrent.InfoHash
	}
	return t.InfoHash
}

func (t *NormalizedTorrent) GetName() string {
	if t.AnimeTorrent != nil && t.AnimeTorrent.Name != "" {
		return t.AnimeTorrent.Name
	}
	return t.Name
}

func (t *NormalizedTorrent) GetSeeders() int {
	if t.AnimeTorrent != nil {
		return t.AnimeTorrent.Seeders
	}
	return t.Seeders
}

func (t *NormalizedTorrent) GetSize() int64 {
	if t.AnimeTorrent != nil {
		return t.AnimeTorrent.Size
	}
	return t.Size
}

// Candidate represents a scored torrent candidate during autodownload selection.
type Candidate struct {
	Score   int
	Torrent *NormalizedTorrent
}

// SimulationResult holds the outcome of an autodownload simulation run for a single torrent.
type SimulationResult struct {
	Episode     int
	Hash        string
	Score       int
	TorrentName string
}
