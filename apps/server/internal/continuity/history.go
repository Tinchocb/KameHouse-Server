package continuity

import (
	"fmt"

	"kamehouse/internal/database/db"
	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
	"time"
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
		Predictive    bool    `json:"predictive"`
		Kind          Kind    `json:"kind"`
	}

)

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) GetWatchHistory() WatchHistory {
	defer util.HandlePanicInModuleThen("continuity/GetWatchHistory", func() {})

	m.mu.RLock()
	defer m.mu.RUnlock()

	items, err := filecache.GetAll[*WatchHistoryItem](m.fileCacher, *m.watchHistoryFileCacheBucket)
	if err != nil {
		m.logger.Error().Err(err).Msg("continuity: Failed to get watch history")
		return nil
	}

	// Hay una clave por media+episodio: quedarse con el más reciente de cada
	// media. Pisar sin comparar dependía del orden de iteración del map.
	ret := make(WatchHistory)
	for _, item := range items {
		if item == nil {
			continue
		}
		if prev, ok := ret[item.MediaID]; !ok || item.TimeUpdated.After(prev.TimeUpdated) {
			ret[item.MediaID] = item
		}
	}

	return ret
}

func (m *Manager) GetWatchHistoryItem(mediaID int) *WatchHistoryItemResponse {
	defer util.HandlePanicInModuleThen("continuity/GetWatchHistoryItem", func() {})

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Get all items and find the latest updated for this mediaID
	items, err := filecache.GetAll[*WatchHistoryItem](m.fileCacher, *m.watchHistoryFileCacheBucket)
	if err != nil {
		return &WatchHistoryItemResponse{Found: false}
	}

	var latestItem *WatchHistoryItem
	for _, item := range items {
		if item != nil && item.MediaID == mediaID {
			if latestItem == nil || item.TimeUpdated.After(latestItem.TimeUpdated) {
				latestItem = item
			}
		}
	}

	if latestItem != nil {
		return &WatchHistoryItemResponse{
			Item:  latestItem,
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

	m.mu.Lock()
	defer m.mu.Unlock()

	added := false

	// Get the current history
	i, found := m.getWatchHistory(opts.MediaID, opts.EpisodeNumber)
	if !found {
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
		i.Kind = opts.Kind
		i.EpisodeNumber = opts.EpisodeNumber
		i.CurrentTime = opts.CurrentTime
		i.Duration = opts.Duration
		i.TimeUpdated = time.Now()
	}

	// Save the i
	err = m.fileCacher.Set(*m.watchHistoryFileCacheBucket, fmt.Sprintf("%d_%d", opts.MediaID, opts.EpisodeNumber), i)
	if err != nil {
		return fmt.Errorf("continuity: Failed to save watch history item: %w", err)
	}

	// If the item was added, check if we need to remove the oldest item
	if added {
		_ = m.trimWatchHistoryItems()
	}

	// Predictive Cache trigger
	if opts.Predictive && opts.Duration > 0 && (opts.CurrentTime/opts.Duration) > 0.8 {
		go m.triggerPredictiveCache(opts.MediaID, opts.EpisodeNumber)
	}

	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (m *Manager) getWatchHistory(mediaID, episodeNumber int) (ret *WatchHistoryItem, exists bool) {
	defer util.HandlePanicInModuleThen("continuity/getWatchHistory", func() {
		ret = nil
		exists = false
	})

	exists, _ = m.fileCacher.Get(*m.watchHistoryFileCacheBucket, fmt.Sprintf("%d_%d", mediaID, episodeNumber), &ret)

	if exists && ret != nil && ret.Duration > 0 {
		// If the item completion ratio is equal or above IgnoreRatioThreshold, don't return anything
		ratio := ret.CurrentTime / ret.Duration
		if ratio >= IgnoreRatioThreshold {
			// Delete the item
			go func() {
				defer util.HandlePanicInModuleThen("continuity/getWatchHistory", func() {})
				_ = m.fileCacher.Delete(*m.watchHistoryFileCacheBucket, fmt.Sprintf("%d_%d", mediaID, episodeNumber))
			}()
			return nil, false
		}
		if ratio < 0.05 {
			return nil, false
		}
	}

	return
}

// removes the oldest WatchHistoryItem from the file cache.
func (m *Manager) trimWatchHistoryItems() error {
	defer util.HandlePanicInModuleThen("continuity/TrimWatchHistoryItems", func() {})

	// Get all the items
	items, err := filecache.GetAll[*WatchHistoryItem](m.fileCacher, *m.watchHistoryFileCacheBucket)
	if err != nil {
		return fmt.Errorf("continuity: Failed to get watch history items: %w", err)
	}

	// If there are too many items, remove the oldest one
	if len(items) > MaxWatchHistoryItems {
		var oldestKey string
		for key, item := range items {
			if item == nil { // entrada corrupta: es la primera en irse
				oldestKey = key
				break
			}
			if oldestKey == "" || item.TimeUpdated.Before(items[oldestKey].TimeUpdated) {
				oldestKey = key
			}
		}
		err = m.fileCacher.Delete(*m.watchHistoryFileCacheBucket, oldestKey)
		if err != nil {
			return fmt.Errorf("continuity: Failed to remove oldest watch history item: %w", err)
		}
	}

	return nil
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// triggerPredictiveCache is called when a user has watched > 80% of an episode.
// It checks if the next episode exists locally, and if not, triggers a PredictiveCacheEpisodeRequestedEvent.
func (m *Manager) triggerPredictiveCache(mediaID int, currentEpisode int) {
	defer util.HandlePanicInModuleThen("continuity/triggerPredictiveCache", func() {})

	nextEpisode := currentEpisode + 1

	// Check if next episode is downloaded
	lfs, _, err := db.GetLocalFiles(m.db)
	if err != nil {
		return
	}

	for _, lf := range lfs {
		if lf.MediaID == mediaID && lf.GetEpisodeNumber() == nextEpisode {
			m.logger.Debug().Int("mediaID", mediaID).Int("episode", nextEpisode).Msg("continuity: Next episode already exists locally, skipping predictive cache")
			return
		}
	}

	m.logger.Info().Int("mediaID", mediaID).Int("episode", nextEpisode).Msg("continuity: Triggering predictive cache download for next episode")

	// Emit hook to start the download

}
