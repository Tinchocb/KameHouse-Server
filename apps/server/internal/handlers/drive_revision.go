package handlers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"kamehouse/internal/drive"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"

	"golang.org/x/sync/singleflight"
)

// A short metadata TTL avoids one Google API request per media range while
// bounding detection of replacements during playback to five seconds.
const driveRevisionTTL = 5 * time.Second

type driveRevisionKey struct {
	client *drive.Client
	fileID string
}

var driveRevisions = result.NewBoundedCache[driveRevisionKey, drive.DriveFile](512)
var driveRevisionGroup singleflight.Group

func driveFileRevision(f *drive.DriveFile) string {
	return util.CreateMD5(fmt.Sprintf("%s:%s:%d", f.MD5Checksum, f.ModifiedTime.UTC().Format(time.RFC3339Nano), f.Size))
}

func (h *Handler) currentDriveFile(ctx context.Context, fileID string) (*drive.DriveFile, error) {
	if h.App.DriveService == nil {
		return nil, errors.New("google drive is not configured")
	}
	client, err := h.App.DriveService.GetClient()
	if err != nil {
		return nil, err
	}
	key := driveRevisionKey{client, fileID}
	if f, ok := driveRevisions.Get(key); ok {
		return &f, nil
	}
	// The shared lookup has its own timeout: one cancelled range must not cancel
	// the metadata lookup required by another reader of this file.
	ch := driveRevisionGroup.DoChan(fmt.Sprintf("%p:%s", client, fileID), func() (interface{}, error) {
		if f, ok := driveRevisions.Get(key); ok {
			return &f, nil
		}
		lookupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		f, err := client.GetFile(lookupCtx, fileID)
		if err == nil && f != nil {
			driveRevisions.SetT(key, *f, driveRevisionTTL)
		}
		return f, err
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return nil, res.Err
		}
		f, ok := res.Val.(*drive.DriveFile)
		if !ok || f == nil {
			return nil, errors.New("drive file metadata unavailable")
		}
		copy := *f
		return &copy, nil
	}
}

func (h *Handler) refreshDriveRevision(ctx context.Context, fileID string) (string, error) {
	f, err := h.currentDriveFile(ctx, fileID)
	if err != nil {
		return "", err
	}
	revision := driveFileRevision(f)
	if h.App.Config != nil && h.App.Config.Cache.Dir != "" {
		if cache := h.driveBlockCache(); cache != nil {
			cache.ValidateRevision(fileID, f.Size, revision)
		}
	}
	if repo := h.App.MediastreamRepository; repo != nil {
		repo.SetDriveRevision(fileID, revision)
	}
	return revision, nil
}
