package anime

import "github.com/samber/lo"

// HasWatchedAll returns true if all episodes have been watched.
// Returns false if there are no downloaded episodes.
func (e *Entry) HasWatchedAll() bool {
	// If there are no episodes, return nil
	latestEp, ok := e.FindLatestEpisode()
	if !ok {
		return false
	}

	return e.GetCurrentProgress() >= latestEp.GetProgressNumber()

}

// FindNextEpisode returns the episode whose episode number is the same as the progress number + 1.
// Returns false if there are no episodes or if there is no next episode.
func (e *Entry) FindNextEpisode() (*Episode, bool) {
	eps, ok := e.FindMainEpisodes()
	if !ok {
		return nil, false
	}

	currentProgress := e.GetCurrentProgress()

	// Try finding by absolute number first for cross-season continuity
	ep, ok := lo.Find(eps, func(ep *Episode) bool {
		return ep.AbsoluteEpisodeNumber == currentProgress+1
	})
	if ok {
		return ep, true
	}

	// Fallback to progress number
	ep, ok = lo.Find(eps, func(ep *Episode) bool {
		return ep.GetProgressNumber() == currentProgress+1
	})
	if ok {
		return ep, true
	}

	return nil, false
}

// FindLatestEpisode returns the *main* episode with the highest episode number.
// Returns false if there are no episodes.
func (e *Entry) FindLatestEpisode() (*Episode, bool) {
	// If there are no episodes, return nil
	eps, ok := e.FindMainEpisodes()
	if !ok {
		return nil, false
	}
	// Get the episode with the highest progress number
	latest := eps[0]
	for _, ep := range eps {
		if ep.GetProgressNumber() > latest.GetProgressNumber() {
			latest = ep
		}
	}
	return latest, true
}

//----------------------------------------------------------------------------------------------------------------------

// GetCurrentProgress returns the progress number.
// If the media entry is not in any collection list, returns 0.
func (e *Entry) GetCurrentProgress() int {
	listData, ok := e.FindListData()
	if !ok {
		return 0
	}
	return listData.Progress
}

// FindMainEpisodes returns the main episodes.
// Returns false if there are no main episodes.
func (e *Entry) FindMainEpisodes() ([]*Episode, bool) {
	if e.Episodes == nil {
		return nil, false
	}
	eps := make([]*Episode, 0)
	for _, ep := range e.Episodes {
		if ep.IsMain() {
			eps = append(eps, ep)
		}
	}
	return eps, true
}

func (e *Entry) FindListData() (*EntryListData, bool) {
	if e.EntryListData == nil {
		return nil, false
	}
	return e.EntryListData, true
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

func (e *SimpleEntry) GetCurrentProgress() int {
	listData, ok := e.FindListData()
	if !ok {
		return 0
	}
	return listData.Progress
}

func (e *SimpleEntry) FindMainEpisodes() ([]*Episode, bool) {
	if e.Episodes == nil {
		return nil, false
	}
	eps := make([]*Episode, 0)
	for _, ep := range e.Episodes {
		if ep.IsMain() {
			eps = append(eps, ep)
		}
	}
	return eps, true
}

func (e *SimpleEntry) FindNextEpisode() (*Episode, bool) {
	eps, ok := e.FindMainEpisodes()
	if !ok {
		return nil, false
	}
	ep, ok := lo.Find(eps, func(ep *Episode) bool {
		return ep.GetProgressNumber() == e.GetCurrentProgress()+1
	})
	if !ok {
		return nil, false
	}
	return ep, true
}

func (e *SimpleEntry) FindListData() (*EntryListData, bool) {
	if e.EntryListData == nil {
		return nil, false
	}
	return e.EntryListData, true
}
