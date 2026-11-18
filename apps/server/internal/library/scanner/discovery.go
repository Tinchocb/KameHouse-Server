package scanner

import (
	"context"
	"errors"
	"io/fs"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

func (scn *Scanner) discoverFilePaths(ctx context.Context, _ time.Time) ([]string, []string, []string) {
	var libraryPaths []string
	isPartial := len(scn.TargetPaths) > 0

	if isPartial {
		libraryPaths = scn.TargetPaths
	} else {
		libraryPaths = append([]string{scn.DirPath}, scn.OtherDirPaths...)
	}

	sortedLibraryPaths := make([]string, len(libraryPaths))
	copy(sortedLibraryPaths, libraryPaths)
	sort.Slice(sortedLibraryPaths, func(i, j int) bool {
		return len(sortedLibraryPaths[i]) > len(sortedLibraryPaths[j])
	})

	retrievedPathMap := make(map[string]struct{})
	paths := make([]string, 0, len(scn.ExistingLocalFiles))
	var mu sync.Mutex
	var logMu sync.Mutex

	dirPool := NewWorkerPool(ctx, len(libraryPaths))
	for _, dirPath := range libraryPaths {
		dirPath := dirPath
		dirPool.Submit(func(_ context.Context) {
			var retrievedPaths []string

			err := filepath.WalkDir(dirPath, func(path string, d fs.DirEntry, err error) error {
				if ctx.Err() != nil {
					return ctx.Err()
				}
				if err != nil {
					// Intercept and skip directory or file on permission error
					if os.IsPermission(err) || errors.Is(err, fs.ErrPermission) {
						scn.Logger.Warn().Str("path", path).Err(err).Msg("scanner: Permission denied, skipping")
						if d != nil && d.IsDir() {
							return filepath.SkipDir
						}
						return nil
					}
					return nil
				}
				if d.IsDir() {
					return nil
				}
				ext := strings.ToLower(filepath.Ext(path))
				if util.IsValidMediaFile(d.Name()) && util.IsValidVideoExtension(ext) {
					retrievedPaths = append(retrievedPaths, path)
				}
				return nil
			})

			if err != nil {
				scn.Logger.Error().Err(err).Str("dir", dirPath).Msg("scanner: error retrieving local files")
				return
			}

			if scn.ScanLogger != nil {
				logMu.Lock()
				scn.ScanLogger.logger.Info().Int("count", len(retrievedPaths)).Str("dir", dirPath).Msg("Retrieved file paths")
				logMu.Unlock()
			}

			for _, path := range retrievedPaths {
				normPath := util.NormalizePath(path)
				mu.Lock()
				if _, ok := retrievedPathMap[normPath]; !ok {
					retrievedPathMap[normPath] = struct{}{}
					paths = append(paths, path)
				}
				mu.Unlock()
			}
		})
	}
	dirPool.Wait()

	return paths, libraryPaths, sortedLibraryPaths
}

func (scn *Scanner) createLocalFiles(ctx context.Context, paths []string, libraryPaths []string, skippedLfs map[string]*dto.LocalFile) []*dto.LocalFile {
	if len(paths) == 0 {
		return []*dto.LocalFile{}
	}
	maxWorkers := runtime.NumCPU() * 2
	if maxWorkers < 4 {
		maxWorkers = 4
	}
	maxWorkers = min(maxWorkers, len(paths))

	// Cada escaneo ordena su propia copia: las raíces pueden provenir de opciones compartidas.
	libraryPaths = append([]string(nil), libraryPaths...)
	// El prefijo más largo gana en SeparateFilePathS; dejar libraryPaths ordenado de mayor a
	// menor longitud, una sola vez y antes de lanzar los workers, conserva el orden que luego
	// usa ParseFolderStructure con raíces anidadas sin que N goroutines reordenen el mismo slice.
	sort.SliceStable(libraryPaths, func(i, j int) bool {
		return len(libraryPaths[i]) > len(libraryPaths[j])
	})

	jobs := make(chan string, maxWorkers)
	results := make(chan *dto.LocalFile, maxWorkers)
	var skipped atomic.Int64

	// Pre-map existing files by path for O(1) lookup in workers
	existingMap := make(map[string]*dto.LocalFile)
	for _, f := range scn.ExistingLocalFiles {
		if f != nil {
			existingMap[util.NormalizePath(f.Path)] = f
		}
	}

	var workerWg sync.WaitGroup
	for i := 0; i < maxWorkers; i++ {
		workerWg.Add(1)
		go func() {
			defer workerWg.Done()
			for path := range jobs {
				select {
				case <-ctx.Done():
					results <- nil
					continue
				default:
				}
				normPath := util.NormalizePath(path)
				if _, ok := skippedLfs[normPath]; ok {
					skipped.Add(1)
					results <- nil
					continue
				}
				stat, err := os.Stat(path)
				if err != nil {
					scn.Logger.Debug().Err(err).Str("path", path).Msg("scanner: File unavailable after discovery, skipping")
					continue
				}
				fileSize := stat.Size()
				fileModTime := stat.ModTime().Unix()

				var lf *dto.LocalFile
				existing, hasExisting := existingMap[normPath]
				// Fast path: if the file was already scanned and size & mtime haven't changed,
				// reuse existing parsed structures directly without invoking habari regex parsing.
				if hasExisting && existing != nil && existing.ParsedData != nil && fileSize == existing.FileSize && fileModTime == existing.FileModTime {
					lf = &dto.LocalFile{
						Path:             path,
						Name:             existing.Name,
						ParsedData:       existing.ParsedData,
						ParsedFolderData: existing.ParsedFolderData,
						EmbeddedMetadata: existing.EmbeddedMetadata,
						Metadata:         existing.Metadata,
						TechnicalInfo:    existing.TechnicalInfo,
						Locked:           existing.Locked,
						Ignored:          existing.Ignored,
						LibraryMediaId:   existing.LibraryMediaId,
						MediaID:          existing.MediaID,
						FileHash:         existing.FileHash,
						FileSize:         fileSize,
						FileModTime:      fileModTime,
						DriveFileID:      existing.DriveFileID,
					}
					if lf.Metadata == nil {
						lf.Metadata = &dto.LocalFileMetadata{
							Episodes:     nil,
							AniDBEpisode: "",
							Type:         "",
						}
					}
				} else {
					lf = dto.NewLocalFileS(path, libraryPaths)
					lf.FileSize = fileSize
					lf.FileModTime = fileModTime

					// Preservation logic: If we already know this file, keep its associations
					// unless the scanner explicitly changes them later.
					if hasExisting && existing != nil {
						lf.MediaID = existing.MediaID
						lf.LibraryMediaId = existing.LibraryMediaId
						lf.Locked = existing.Locked
						lf.Ignored = existing.Ignored
						if lf.FileSize == existing.FileSize && lf.FileModTime == existing.FileModTime {
							lf.FileHash = existing.FileHash
						}
						// Copy metadata if it was already matched
						if lf.MediaID != 0 {
							lf.Metadata = existing.Metadata
						}
					}
				}

				if scn.ScanMode == "deep" {
					// Only files actually being rescanned lose their identity, and only
					// in this working copy. Locked/ignored/offline/Drive files stay intact.
					lf = lf.Clone()
					lf.Metadata = &dto.LocalFileMetadata{}
					lf.MediaID = 0
					lf.LibraryMediaId = 0
				}
				results <- lf
			}
		}()
	}

	go func() {
		defer close(jobs)
		for _, p := range paths {
			select {
			case jobs <- p:
			case <-ctx.Done():
				return
			}
		}
	}()

	go func() {
		workerWg.Wait()
		close(results)
	}()

	localFiles := make([]*dto.LocalFile, 0, len(paths))
	total := len(paths)
	lastEventTime := time.Now()

	for lf := range results {
		if lf != nil {
			localFiles = append(localFiles, lf)
			current := len(localFiles)

			if scn.EventDispatcher != nil {
				shouldPublish := current == 1 || current == total || current%25 == 0 || time.Since(lastEventTime) > 200*time.Millisecond
				if shouldPublish {
					scn.EventDispatcher.Publish(events.Event{
						Topic: "library.scan",
						Payload: map[string]any{
							"status":  "PROCESSING",
							"current": current,
							"total":   total,
							"file":    lf.Name,
						},
					})
					lastEventTime = time.Now()
				}
			}
		}
	}
	return localFiles
}
