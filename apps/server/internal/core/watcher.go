package core

import (
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/util"
	"sync"
)

// A generation is reserved synchronously when settings change, before starting
// background filesystem work. Only that generation may publish its result.
type libraryWatcherState struct {
	mu         sync.RWMutex
	generation uint64
	closed     bool
}

func (a *App) GetTotalLibrarySize() uint64 {
	a.libraryWatcher.mu.RLock()
	defer a.libraryWatcher.mu.RUnlock()
	return a.TotalLibrarySize
}

func (a *App) beginLibraryWatcherRefresh() (uint64, bool) {
	s := &a.libraryWatcher
	s.mu.Lock()
	defer s.mu.Unlock()
	s.generation++
	if a.Watcher != nil {
		a.Watcher.StopWatching()
		a.Watcher = nil
	}
	return s.generation, !s.closed && a.ShutdownCtx().Err() == nil
}

func (a *App) refreshLibraryWatcher(paths []string, enabled bool) {
	generation, open := a.beginLibraryWatcherRefresh()
	if !open || !enabled || len(paths) == 0 {
		return
	}
	paths = append([]string(nil), paths...)
	go func() {
		defer util.RecoverInModule("core/modules/InitWatcher")
		a.initializeLibraryWatcher(generation, paths, a.buildLibraryWatcher)
	}()
}

func (a *App) stopLibraryWatcher() {
	s := &a.libraryWatcher
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	s.generation++
	if a.Watcher != nil {
		a.Watcher.StopWatching()
		a.Watcher = nil
	}
}

func (a *App) initializeLibraryWatcher(generation uint64, paths []string, build func([]string) (*scanner.Watcher, uint64, error)) {
	watcher, size, err := build(paths)
	if err != nil {
		if watcher != nil {
			watcher.StopWatching()
		}
		a.Logger.Error().Err(err).Msg("app: Failed to watch library files")
		return
	}
	// Every unpublished result is owned by this function, including stale and
	// panicking initializations. A late result must never orphan an OS watcher.
	published := false
	defer func() {
		if !published {
			watcher.StopWatching()
		}
	}()
	s := &a.libraryWatcher
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || generation != s.generation || a.ShutdownCtx().Err() != nil {
		return
	}
	a.Watcher = watcher
	a.TotalLibrarySize = size
	watcher.StartWatching(func(path string) {
		s.mu.RLock()
		current := !s.closed && s.generation == generation
		s.mu.RUnlock()
		if current {
			a.AutoScanner.Notify(path)
		}
	})
	published = true
	a.Logger.Info().Msgf("watcher: Library size: %s", util.Bytes(size))
}

// buildLibraryWatcher performs slow filesystem work without holding the
// publication lock. Ownership transfers to initializeLibraryWatcher on return.
func (a *App) buildLibraryWatcher(paths []string) (*scanner.Watcher, uint64, error) {
	// Create a new watcher
	watcher, err := scanner.NewWatcher(&scanner.NewWatcherOptions{
		Logger:         a.Logger,
		WSEventManager: a.WSEventManager,
	})
	if err != nil {
		return nil, 0, err
	}
	ready := false
	defer func() {
		if !ready {
			watcher.StopWatching()
		}
	}()

	// Initialize library file watcher
	err = watcher.InitLibraryFileWatcher(&scanner.WatchLibraryFilesOptions{
		LibraryPaths: paths,
	})
	if err != nil {
		return nil, 0, err
	}

	var dirSize uint64 = 0
	mu := sync.Mutex{}
	wg := sync.WaitGroup{}
	for _, path := range paths {
		wg.Add(1)
		go func(path string) {
			defer wg.Done()
			ds, _ := util.DirSize(path)
			mu.Lock()
			dirSize += ds
			mu.Unlock()
		}(path)
	}
	wg.Wait()
	ready = true
	return watcher, dirSize, nil
}
