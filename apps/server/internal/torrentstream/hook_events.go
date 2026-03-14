package torrentstream

type TorrentSelectionRequestedEvent struct {
	Torrent interface{}
}

func (e *TorrentSelectionRequestedEvent) PreventDefault() {
}
