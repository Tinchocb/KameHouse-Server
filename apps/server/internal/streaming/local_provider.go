package streaming

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"path/filepath"
	"strings"
)

// LocalProvider resolves streams from local files on disk.
// It wraps the existing direct stream functionality and provides
// file:// URLs for media that exists in the local library.
type LocalProvider struct {
	db *db.Database
}

// NewLocalProvider creates a new local file stream provider.
func NewLocalProvider(db *db.Database) *LocalProvider {
	return &LocalProvider{db: db}
}

func (p *LocalProvider) Name() string { return "local" }

func (p *LocalProvider) SupportsMedia(mediaID int) bool {
	// Check if we have any local files matching this media ID
	lfs, _, err := db.GetLocalFiles(p.db)
	if err != nil {
		return false
	}

	for _, lf := range lfs {
		if lf.MediaId == mediaID {
			return true
		}
	}

	return false
}

func (p *LocalProvider) ResolveStream(ctx context.Context, req StreamRequest) (*StreamResult, error) {
	lfs, _, err := db.GetLocalFiles(p.db)
	if err != nil {
		return nil, err
	}

	// Find a local file matching the request
	var bestMatch *dto.LocalFile
	for _, lf := range lfs {
		if lf.MediaId != req.MediaID {
			continue
		}

		// Match by episode number if specified
		if req.EpisodeNumber > 0 {
			ep := lf.GetEpisodeNumber()
			if ep != req.EpisodeNumber {
				continue
			}
		}

		bestMatch = lf
		break
	}

	if bestMatch == nil {
		return nil, ErrMediaNotFound
	}

	ext := strings.ToLower(filepath.Ext(bestMatch.Path))
	mimeType := "video/mp4"
	switch ext {
	case ".mkv":
		mimeType = "video/x-matroska"
	case ".avi":
		mimeType = "video/x-msvideo"
	case ".webm":
		mimeType = "video/webm"
	}

	return &StreamResult{
		URL:      bestMatch.Path,
		Type:     StreamTypeLocalFile,
		MimeType: mimeType,
		Filename: bestMatch.Name,
	}, nil
}
