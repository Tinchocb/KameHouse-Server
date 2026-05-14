package scanner

import (
	"kamehouse/internal/events"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog"
)

// Watcher is a custom file system event watcher
type Watcher struct {
	Watcher        *fsnotify.Watcher
	Logger         *zerolog.Logger
	WSEventManager events.WSEventManagerInterface
	TotalSize      string
	Debouncer      *FileDebouncer
}

type NewWatcherOptions struct {
	Logger         *zerolog.Logger
	WSEventManager events.WSEventManagerInterface
}

// NewWatcher creates a new Watcher instance for monitoring a directory and its subdirectories
func NewWatcher(opts *NewWatcherOptions) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &Watcher{
		Watcher:        watcher,
		Logger:         opts.Logger,
		WSEventManager: opts.WSEventManager,
		Debouncer:      NewFileDebouncer(),
	}, nil
}

//----------------------------------------------------------------------------------------------------------------------

type WatchLibraryFilesOptions struct {
	LibraryPaths []string
}

// InitLibraryFileWatcher starts watching the specified directory and its subdirectories for file system events
func (w *Watcher) InitLibraryFileWatcher(opts *WatchLibraryFilesOptions) error {
	// Define a function to add directories and their subdirectories to the watcher
	watchDir := func(dir string) error {
		err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				return w.Watcher.Add(path)
			}
			return nil
		})
		return err
	}

	// Add the initial directory and its subdirectories to the watcher
	for _, path := range opts.LibraryPaths {
		if err := watchDir(path); err != nil {
			return err
		}
	}

	w.Logger.Info().Msgf("watcher: Watching directories: %+v", opts.LibraryPaths)

	return nil
}

func (w *Watcher) StartWatching(
	onFileAction func(path string),
) {
	// Start a goroutine to handle file system events
	go func() {
		triggerAction := func(path string) {
			w.Logger.Debug().Str("path", path).Msg("watcher: Debounce timer triggered, calling onFileAction")
			onFileAction(path)
		}

		validExtensions := map[string]bool{
			".mkv":  true,
			".mp4":  true,
			".avi":  true,
			".m4v":  true,
			".webm": true,
		}

		for {
			select {
			case event, ok := <-w.Watcher.Events:
				if !ok {
					return
				}

				// 1. Ignore pure chmod events
				if event.Op == fsnotify.Chmod {
					continue
				}

				// 2. Ignore temporary files or known bad extensions
				if strings.Contains(event.Name, ".part") || strings.Contains(event.Name, ".tmp") ||
					strings.Contains(event.Name, ".DS_Store") || strings.Contains(event.Name, ".!qB") ||
					strings.Contains(event.Name, ".crdownload") || strings.Contains(event.Name, ".utxt") {
					continue
				}

				// 3. Filter by valid media extensions for Write/Create events
				ext := strings.ToLower(filepath.Ext(event.Name))
				isDirCreate := event.Op&fsnotify.Create != 0 && ext == ""
				if event.Op&(fsnotify.Create|fsnotify.Write) != 0 && !validExtensions[ext] && !isDirCreate {
					continue
				}

				if event.Op&fsnotify.Create == fsnotify.Create {
					// If a new directory is created, register it and its subdirectories for watching
					if info, statErr := os.Stat(event.Name); statErr == nil && info.IsDir() {
						_ = filepath.Walk(event.Name, func(p string, fi os.FileInfo, walkErr error) error {
							if walkErr != nil {
								return nil
							}
							if fi.IsDir() {
								if addErr := w.Watcher.Add(p); addErr != nil {
									// 4. OS Limit Mitigation
									if strings.Contains(addErr.Error(), "too many open files") || strings.Contains(addErr.Error(), "no space left on device") {
										w.Logger.Warn().Err(addErr).Msgf("watcher: OS watch limit reached. Consider increasing fs.inotify.max_user_watches. Skipping directory %s", p)
									} else {
										w.Logger.Warn().Err(addErr).Msgf("watcher: Failed to watch new directory: %s", p)
									}
								} else {
									w.Logger.Debug().Msgf("watcher: Now watching new directory: %s", p)
								}
							}
							return nil
						})
					} else {
						w.Logger.Debug().Msgf("watcher: Media file created/modified: %s", event.Name)
						w.WSEventManager.SendEvent(events.LibraryWatcherFileAdded, event.Name)
						// 5. Debounce the library scan action
						w.Debouncer.Add(event.Name, 5*time.Second, func() {
							triggerAction(event.Name)
						})
					}
				}

				if event.Op&fsnotify.Write == fsnotify.Write {
					w.Logger.Debug().Msgf("watcher: Media file modified: %s", event.Name)
					w.Debouncer.Add(event.Name, 5*time.Second, func() {
						triggerAction(event.Name)
					})
				}

				if event.Op&fsnotify.Remove == fsnotify.Remove {
					w.Logger.Debug().Msgf("watcher: File/Directory removed: %s", event.Name)
					w.WSEventManager.SendEvent(events.LibraryWatcherFileRemoved, event.Name)
					w.Debouncer.Add(event.Name, 5*time.Second, func() {
						triggerAction(event.Name)
					})
				}

			case err, ok := <-w.Watcher.Errors:
				if !ok {
					return
				}
				w.Logger.Warn().Err(err).Msgf("watcher: Error while watching directory")
			}
		}
	}()
}

func (w *Watcher) StopWatching() {
	err := w.Watcher.Close()
	if err != nil {
		w.Logger.Error().Err(err).Msg("watcher: Error stopping watcher")
	} else {
		w.Logger.Trace().Msg("watcher: Watcher stopped")
	}
}
