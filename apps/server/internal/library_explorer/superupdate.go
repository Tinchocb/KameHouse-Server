package library_explorer

import (
	"errors"
	"os"
	"path/filepath"
	"sync"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"

	"github.com/samber/lo"
)

type SuperUpdateFileOptions struct {
	// Path to the file
	Path string `json:"path"`
	// New name of the file
	NewName string `json:"newName,omitempty"`
	// Metadata of the file
	Metadata *dto.LocalFileMetadata `json:"metadata,omitempty"`
}

func (l *LibraryExplorer) SuperUpdateFiles(opts []*SuperUpdateFileOptions) error {

	const MaxConcurrentUpdates = 10
	sem := make(chan struct{}, MaxConcurrentUpdates)
	var mu sync.Mutex
	var firstErr error
	var wg sync.WaitGroup

	l.logger.Debug().
		Int("count", len(opts)).
		Msg("library explorer: Updating files")

	wg.Add(len(opts))

	lfs, lfsID, err := db.GetLocalFiles(l.database)
	if err != nil {
		return err
	}

	settings, err := l.database.GetSettings()
	if err != nil {
		return err
	}

	for _, opt := range opts {
		go func(opt *SuperUpdateFileOptions) {
			sem <- struct{}{}
			defer func() { <-sem }()
			defer wg.Done()
			if err := l.superUpdateFile(opt, lfs, &mu, lfsID, settings.GetLibrary().GetAllPaths()); err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
			}
		}(opt)
	}

	wg.Wait()

	if firstErr != nil {
		l.logger.Error().Err(firstErr).Msg("library explorer: super update completed with errors")
	}

	// Save the local files
	_, err = db.SaveLocalFiles(l.database, lfsID, lfs)
	if err != nil {
		return err
	}

	l.fileTree = nil

	return nil
}

func (l *LibraryExplorer) superUpdateFile(opt *SuperUpdateFileOptions, lfs []*dto.LocalFile, mu *sync.Mutex, lfsID uint, libraryPaths []string) error {

	l.logger.Debug().
		Any("path", opt.Path).
		Msg("library explorer: Updating file")

	mu.Lock()
	lf, found := lo.Find(lfs, func(i *dto.LocalFile) bool {
		return i.HasSamePath(opt.Path)
	})
	mu.Unlock()

	isAllowed := false
	for _, lp := range libraryPaths {
		if util.IsFileUnderDir(lp, opt.Path) || util.IsSameDir(filepath.Dir(opt.Path), lp) {
			isAllowed = true
			break
		}
	}
	if !isAllowed {
		return errors.New("unauthorized: file path is not within library directories")
	}

	if opt.NewName != "" {
		sanitizedNewName := filepath.Base(opt.NewName)
		if sanitizedNewName == "." || sanitizedNewName == "/" || sanitizedNewName == "\\" {
			return errors.New("invalid new filename")
		}
		newPath := filepath.Join(filepath.Dir(opt.Path), sanitizedNewName)
		// Re-validar destino bajo librería antes del rename (TOCTOU).
		newAllowed := false
		for _, lp := range libraryPaths {
			if util.IsFileUnderDir(lp, newPath) || util.IsSameDir(filepath.Dir(newPath), lp) {
				newAllowed = true
				break
			}
		}
		if !newAllowed {
			return errors.New("unauthorized: destination path is not within library directories")
		}
		// Update the file name
		// If the local file exists, update the name
		if found {
			mu.Lock()
			lf.Name = sanitizedNewName
			// Update the parsed info
			newLf := dto.NewLocalFileS(newPath, libraryPaths)
			lf.ParsedData = newLf.ParsedData
			lf.ParsedFolderData = newLf.ParsedFolderData
			lf.Path = newPath
			mu.Unlock()
		}

		// Rename the real file name
		err := os.Rename(opt.Path, newPath)
		if err != nil {
			return err
		}
	}

	if opt.Metadata != nil {
		l.logger.Debug().
			Any("path", opt.Path).
			Any("metadata", opt.Metadata).
			Msg("library explorer: Updating file metadata")
		if found {
			mu.Lock()
			lf.Metadata = opt.Metadata
			lf.Locked = true
			lf.Ignored = false
			mu.Unlock()
		}
	}

	return nil
}
