package continuity

import (
	"fmt"
	"time"

	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
)

const (
	MaxWatchHistoryItems   = 100
	IgnoreRatioThreshold   = 0.9
	WatchHistoryBucketName = "watch_history"
)

type (
	// WatchHistory is a map of WatchHistoryItem.
	// The key is the WatchHistoryItem.MediaID.
	WatchHistory map[int]*WatchHistoryItem

	// WatchHistoryItem are stored in the file cache.
	// The history is used to resume playback from the last known position.
	// Item.MediaID and Item.EpisodeNumber are used to identify the media and episode.
	// Only one Item per MediaID should exist in the history.
	WatchHistoryItem struct {
		Kind Kind `json:"kind"`
		// Used for MediastreamKind and ExternalPlayerKind.
		Filepath      string `json:"filepath"`
		MediaID       int    `json:"mediaId"`
		EpisodeNumber int    `json:"episodeNumber"`
		// The current playback time in seconds.
		// Used to determine when to remove the item from the history.
		CurrentTime float64 `json:"currentTime"`
		// The duration of the media in seconds.
		Duration float64 `json:"duration"`
		// Timestamp of when the item was added to the history.
		TimeAdded time.Time `json:"timeAdded"`
		// TimeAdded is used in conjunction with TimeUpdated
		// Timestamp of when the item was last updated.
		// Used to determine when to remove the item from the history (First in, first out).
		TimeUpdated time.Time `json:"timeUpdated"`
	}

	WatchHistoryItemResponse struct {
		Item  *WatchHistoryItem `json:"item"`
		Found bool              `json:"found"`
	}

	UpdateWatchHistoryItemOptions struct {
		CurrentTime   float64 `json:"currentTime"`
		Duration      float64 `json:"duration"`
		MediaID       int     `json:"mediaId"`
		EpisodeNumber int     `json:"episodeNumber"`
		Filepath      string  `json:"filepath,omitempty"`
		Kind          Kind    `json:"kind"`
	}
)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) ensureLoaded() {
	m.loadOnce.Do(func() {
		m.mediaLatestIndex = make(map[int]*WatchHistoryItem)
		m.historyItemIndex = make(map[string]*WatchHistoryItem)
		if m.fileCacher != nil && m.watchHistoryFileCacheBucket != nil {
			items, err := filecache.GetAll[*WatchHistoryItem](m.fileCacher, *m.watchHistoryFileCacheBucket)
			if err == nil {
				for key, item := range items {
					if item == nil {
						continue
					}
					m.historyItemIndex[key] = item
					if prev, ok := m.mediaLatestIndex[item.MediaID]; !ok || item.TimeUpdated.After(prev.TimeUpdated) {
						m.mediaLatestIndex[item.MediaID] = item
					}
				}
			}
		}
	})
}

func (m *Manager) GetWatchHistory() WatchHistory {
	defer util.HandlePanicInModuleThen("continuity/GetWatchHistory", func() {})

	m.ensureLoaded()

	m.mu.RLock()
	defer m.mu.RUnlock()

	ret := make(WatchHistory, len(m.mediaLatestIndex))
	for k, v := range m.mediaLatestIndex {
		if v != nil {
			copyItem := *v
			ret[k] = &copyItem
		}
	}

	return ret
}

func (m *Manager) GetWatchHistoryItem(mediaID int) *WatchHistoryItemResponse {
	defer util.HandlePanicInModuleThen("continuity/GetWatchHistoryItem", func() {})

	m.ensureLoaded()

	m.mu.RLock()
	defer m.mu.RUnlock()

	item, ok := m.mediaLatestIndex[mediaID]
	if ok && item != nil {
		copyItem := *item
		return &WatchHistoryItemResponse{
			Item:  &copyItem,
			Found: true,
		}
	}

	return &WatchHistoryItemResponse{
		Item:  nil,
		Found: false,
	}
}

// UpdateWatchHistoryItem updates the WatchHistoryItem in the file cache.
func (m *Manager) UpdateWatchHistoryItem(opts *UpdateWatchHistoryItemOptions) (err error) {
	defer util.HandlePanicInModuleWithError("continuity/UpdateWatchHistoryItem", &err)

	m.ensureLoaded()

	m.mu.Lock()
	defer m.mu.Unlock()
	key := fmt.Sprintf("%d_%d", opts.MediaID, opts.EpisodeNumber)
	added := false

	// Get the current history
	i, found := m.getWatchHistory(opts.MediaID, opts.EpisodeNumber)
	if !found || i == nil {
		added = true
		i = &WatchHistoryItem{
			Kind:          opts.Kind,
			Filepath:      opts.Filepath,
			MediaID:       opts.MediaID,
			EpisodeNumber: opts.EpisodeNumber,
			CurrentTime:   opts.CurrentTime,
			Duration:      opts.Duration,
			TimeAdded:     time.Now(),
			TimeUpdated:   time.Now(),
		}
	} else {
		// File-cache snapshots may be serialized after its own lock is released.
		// Never mutate an item that has already been published there.
		copyItem := *i
		i = &copyItem
		i.Kind = opts.Kind
		i.EpisodeNumber = opts.EpisodeNumber
		i.CurrentTime = opts.CurrentTime
		i.Duration = opts.Duration
		i.TimeUpdated = time.Now()
	}

	m.historyItemIndex[key] = i
	if prev, ok := m.mediaLatestIndex[opts.MediaID]; !ok || i.TimeUpdated.After(prev.TimeUpdated) {
		m.mediaLatestIndex[opts.MediaID] = i
	}

	// Save to file cache (async debounced, never blocks playback HTTP thread)
	err = m.fileCacher.Set(*m.watchHistoryFileCacheBucket, key, i)
	if err != nil {
		return fmt.Errorf("continuity: Failed to save watch history item: %w", err)
	}

	// If the item was added, check if we need to remove the oldest item
	if added {
		_ = m.trimWatchHistoryItems()
	}

	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) getWatchHistory(mediaID, episodeNumber int) (ret *WatchHistoryItem, exists bool) {
	defer util.HandlePanicInModuleThen("continuity/getWatchHistory", func() {
		ret = nil
		exists = false
	})

	m.ensureLoaded()
	key := fmt.Sprintf("%d_%d", mediaID, episodeNumber)
	item, ok := m.historyItemIndex[key]
	if !ok || item == nil {
		// Fallback to fileCacher in case of unindexed entry
		var cached *WatchHistoryItem
		if found, _ := m.fileCacher.Get(*m.watchHistoryFileCacheBucket, key, &cached); found && cached != nil {
			item = cached
			m.historyItemIndex[key] = item
		} else {
			return nil, false
		}
	}

	if item.Duration > 0 {
		// If the item completion ratio is equal or above IgnoreRatioThreshold, don't return anything
		ratio := item.CurrentTime / item.Duration
		if ratio >= IgnoreRatioThreshold {
			delete(m.historyItemIndex, key)
			if latest := m.mediaLatestIndex[mediaID]; latest == item {
				delete(m.mediaLatestIndex, mediaID)
				for _, it := range m.historyItemIndex {
					if it != nil && it.MediaID == mediaID {
						if cur, ok := m.mediaLatestIndex[mediaID]; !ok || it.TimeUpdated.After(cur.TimeUpdated) {
							m.mediaLatestIndex[mediaID] = it
						}
					}
				}
			}
			// Delete only the old entry, before UpdateWatchHistoryItem publishes
			// its replacement under m.mu. Delete itself only schedules disk I/O.
			_ = m.fileCacher.Delete(*m.watchHistoryFileCacheBucket, key)
			return nil, false
		}
		if ratio < 0.05 {
			return nil, false
		}
	}

	return item, true
}

// removes the oldest WatchHistoryItem from the memory index and file cache.
func (m *Manager) trimWatchHistoryItems() error {
	defer util.HandlePanicInModuleThen("continuity/TrimWatchHistoryItems", func() {})

	if len(m.historyItemIndex) > MaxWatchHistoryItems {
		var oldestKey string
		var oldestItem *WatchHistoryItem
		for key, item := range m.historyItemIndex {
			if item == nil {
				oldestKey = key
				break
			}
			if oldestItem == nil || item.TimeUpdated.Before(oldestItem.TimeUpdated) {
				oldestKey = key
				oldestItem = item
			}
		}
		if oldestKey != "" {
			if oldestItem != nil {
				delete(m.historyItemIndex, oldestKey)
				if m.mediaLatestIndex[oldestItem.MediaID] == oldestItem {
					delete(m.mediaLatestIndex, oldestItem.MediaID)
				}
			}
			err := m.fileCacher.Delete(*m.watchHistoryFileCacheBucket, oldestKey)
			if err != nil {
				return fmt.Errorf("continuity: Failed to remove oldest watch history item: %w", err)
			}
		}
	}

	return nil
}
