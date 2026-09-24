package drive

import (
	"context"
	"fmt"
	"path"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
)

const (
	// Tope de archivos listados en el progreso (todo lo detectado en el escaneo).
	scanItemsLimit      = 5000
	scanEmitInterval    = 250 * time.Millisecond
	scanMoviesGroupName = "Películas y especiales"
)

// ScanResult summarizes a finished Drive scan.
type ScanResult struct {
	Indexed int
	Pruned  int
}

// RunScan lists, indexes and prunes the configured Drive folder, updating the live
// progress snapshot as it goes. emit receives throttled snapshots (at most one every
// 250ms, plus a final one) and may be nil. The caller must have called TryStartScan and
// must call FinishScan afterwards.
func (s *Service) RunScan(ctx context.Context, db *gorm.DB, emit func(*ScanProgress)) (res ScanResult, err error) {
	var dirty atomic.Bool
	stopEmitter := make(chan struct{})
	emitterDone := make(chan struct{})
	flush := func() {
		if emit != nil {
			emit(s.GetProgress())
		}
	}
	go func() {
		defer close(emitterDone)
		t := time.NewTicker(scanEmitInterval)
		defer t.Stop()
		for {
			select {
			case <-stopEmitter:
				return
			case <-t.C:
				if dirty.Swap(false) {
					flush()
				}
			}
		}
	}()
	update := func(fn func(p *ScanProgress)) {
		s.updateProgress(fn)
		dirty.Store(true)
	}

	defer func() {
		close(stopEmitter)
		<-emitterDone
		now := time.Now()
		s.updateProgress(func(p *ScanProgress) {
			p.FinishedAt = &now
			p.CurrentFolder = ""
			if err != nil {
				p.Phase = ScanPhaseError
				p.Error = err.Error()
			} else {
				p.Phase = ScanPhaseDone
			}
		})
		flush()
	}()

	client, err := s.GetClient()
	if err != nil {
		return res, err
	}
	folderID := s.GetFolderID()
	if folderID == "" {
		return res, fmt.Errorf("no Google Drive folder configured")
	}

	// 1. Walk the folder tree, resolving each file's series for the live feed.
	seriesIdx := make(map[string]int)
	files, err := client.ListVideoFiles(ctx, folderID, func(folderPath string, found []DriveFile, pending int) {
		update(func(p *ScanProgress) {
			p.FoldersScanned++
			p.FoldersPending = pending
			p.FilesFound += len(found)
			if folderPath == "" {
				p.CurrentFolder = "/"
			} else {
				p.CurrentFolder = folderPath
			}
			for _, df := range found {
				r := ResolveDriveFile(df, 0)
				group := r.SeriesTitle
				if r.IsMovie {
					group = scanMoviesGroupName
				}
				if i, ok := seriesIdx[group]; ok {
					p.Series[i].Count++
				} else {
					seriesIdx[group] = len(p.Series)
					p.Series = append(p.Series, ScanSeriesCount{Title: group, Count: 1})
				}
				p.Items = pushItem(p.Items, ScanItem{
					Name:    df.Name,
					Folder:  folderPath,
					Series:  r.SeriesTitle,
					Episode: r.EpisodeNumber,
					IsMovie: r.IsMovie,
				})
			}
		})
	})
	if err != nil {
		return res, fmt.Errorf("listing Drive folder: %w", err)
	}

	// 2. Resolve + persist.
	update(func(p *ScanProgress) {
		p.Phase = ScanPhaseIndexing
		p.Total = len(files)
		p.FoldersPending = 0
	})
	res.Indexed, err = IndexDriveFiles(ctx, db, files, IndexHooks{
		OnFile: func(done, total int, df DriveFile, _ ResolvedDriveFile) {
			update(func(p *ScanProgress) {
				p.Indexed = done
				if dir := path.Dir(df.RelativePath); dir != "." {
					p.CurrentFolder = dir
				} else {
					p.CurrentFolder = "/"
				}
			})
		},
		OnSaving: func(int) {
			update(func(p *ScanProgress) {
				p.Phase = ScanPhaseSaving
				p.CurrentFolder = ""
			})
		},
	})
	if err != nil {
		return res, err
	}

	// 3. Prune files that disappeared from Drive. The listing above is complete (any API
	// error aborts), but an empty result is more likely a wrong folder or permission
	// problem than a genuinely empty library, so never wipe everything on it.
	if len(files) == 0 {
		return res, nil
	}
	update(func(p *ScanProgress) { p.Phase = ScanPhasePruning })
	res.Pruned, err = PruneDriveFiles(ctx, db, files)
	update(func(p *ScanProgress) { p.Pruned = res.Pruned })
	return res, err
}

func pushItem(items []ScanItem, item ScanItem) []ScanItem {
	if len(items) >= scanItemsLimit {
		return items
	}
	return append(items, item)
}
