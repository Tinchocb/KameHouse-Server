package drive

import (
	"context"
	"fmt"
	"io"
	"kamehouse/internal/util/result"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// subtitleListTTL es cuánto se reutiliza el listado de subtítulos de una carpeta.
// Abrir varios episodios seguidos de la misma carpeta no repite las llamadas a Google.
const subtitleListTTL = 2 * time.Minute

// maxSubtitleListPages acota la paginación: una carpeta con miles de subtítulos no
// debe demorar el arranque de la reproducción.
const maxSubtitleListPages = 5

type subtitleListEntry struct {
	files     []DriveFile
	expiresAt time.Time
}

type subtitleListingCache struct {
	once           sync.Once
	files, folders *result.BoundedCache[string, subtitleListEntry]
	mu             sync.Mutex
	loading        map[string]*subtitleFolderLoad
}

type subtitleFolderLoad struct {
	done     chan struct{}
	entry    subtitleListEntry
	err      error
	canceled bool
}

func (c *Client) subtitleCache() *subtitleListingCache {
	cache := &c.subtitleLists
	cache.once.Do(func() {
		cache.files = result.NewBoundedCache[string, subtitleListEntry](256)
		cache.folders = result.NewBoundedCache[string, subtitleListEntry](256)
		cache.loading = make(map[string]*subtitleFolderLoad)
	})
	return cache
}

func (c *Client) subtitleParent(ctx context.Context, fileID string) (string, error) {
	if !safeFileID(fileID) {
		return "", fmt.Errorf("invalid drive file id %q", fileID)
	}

	var meta struct {
		Parents []string `json:"parents"`
	}
	u, _ := url.Parse(c.api("/files/" + fileID))
	q := u.Query()
	q.Set("fields", "parents")
	q.Set("supportsAllDrives", "true")
	u.RawQuery = q.Encode()
	if err := c.getJSON(ctx, u.String(), &meta); err != nil {
		return "", err
	}
	if len(meta.Parents) == 0 {
		return "", nil
	}
	parent := meta.Parents[0]
	if !safeFileID(parent) {
		return "", fmt.Errorf("invalid drive parent id %q", parent)
	}
	return parent, nil
}

func (c *Client) listFolderSubtitles(ctx context.Context, parent string) ([]DriveFile, error) {
	var out []DriveFile
	pageToken := ""
	for page := 0; page < maxSubtitleListPages; page++ {
		lu, _ := url.Parse(c.api("/files"))
		lq := lu.Query()
		lq.Set("q", fmt.Sprintf("'%s' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder' and (name contains '.srt' or name contains '.ass' or name contains '.ssa' or name contains '.vtt')", parent))
		lq.Set("fields", "nextPageToken, files(id, name, size, modifiedTime, md5Checksum)")
		lq.Set("pageSize", "1000")
		lq.Set("supportsAllDrives", "true")
		lq.Set("includeItemsFromAllDrives", "true")
		if pageToken != "" {
			lq.Set("pageToken", pageToken)
		}
		lu.RawQuery = lq.Encode()

		var result apiFilesResponse
		if err := c.getJSON(ctx, lu.String(), &result); err != nil {
			return nil, err
		}
		for _, item := range result.Files {
			size, _ := strconv.ParseInt(item.Size, 10, 64)
			out = append(out, DriveFile{
				ID:           item.ID,
				Name:         item.Name,
				Size:         size,
				ModifiedTime: item.ModifiedTime,
				MD5Checksum:  item.MD5Checksum,
				RelativePath: item.Name,
			})
		}
		pageToken = result.NextPageToken
		if pageToken == "" {
			break
		}
	}
	return out, nil
}

// SiblingSubtitleFiles lista los subtítulos de la carpeta del archivo, con una caché
// corta en memoria (los errores no se cachean).
func (s *Service) SiblingSubtitleFiles(ctx context.Context, fileID string) ([]DriveFile, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	client, err := s.GetClient()
	if err != nil {
		return nil, err
	}
	cache := client.subtitleCache()
	if e, ok := cache.files.Get(fileID); ok && time.Now().Before(e.expiresAt) {
		return slices.Clone(e.files), nil
	}
	parent, err := client.subtitleParent(ctx, fileID)
	if err != nil {
		return nil, err
	}
	if parent == "" {
		cache.files.SetT(fileID, subtitleListEntry{expiresAt: time.Now().Add(subtitleListTTL)}, subtitleListTTL)
		return nil, nil
	}
	entry, err := client.cachedFolderSubtitles(ctx, parent)
	if err != nil {
		return nil, err
	}
	// File hits share the folder's original expiry; visiting a new episode must
	// not extend the lifetime of an older folder listing by another full TTL.
	cache.files.SetT(fileID, entry, time.Until(entry.expiresAt))
	return slices.Clone(entry.files), nil
}

// The caller owning a cold load performs the HTTP request synchronously. Other
// callers can leave independently; if the owner cancels, a live waiter retries
// with its own context instead of inheriting the owner's cancellation.
func (c *Client) cachedFolderSubtitles(ctx context.Context, parent string) (subtitleListEntry, error) {
	cache := c.subtitleCache()
	for {
		if err := ctx.Err(); err != nil {
			return subtitleListEntry{}, err
		}
		cache.mu.Lock()
		if entry, ok := cache.folders.Get(parent); ok && time.Now().Before(entry.expiresAt) {
			cache.mu.Unlock()
			return entry, nil
		}
		if pending := cache.loading[parent]; pending != nil {
			cache.mu.Unlock()
			select {
			case <-ctx.Done():
				return subtitleListEntry{}, ctx.Err()
			case <-pending.done:
			}
			if err := ctx.Err(); err != nil {
				return subtitleListEntry{}, err
			}
			if pending.canceled {
				continue
			}
			return pending.entry, pending.err
		}
		pending := &subtitleFolderLoad{done: make(chan struct{})}
		cache.loading[parent] = pending
		cache.mu.Unlock()

		files, err := c.listFolderSubtitles(ctx, parent)
		if ctxErr := ctx.Err(); ctxErr != nil {
			err = ctxErr
			pending.canceled = true
		}
		pending.err = err
		if err == nil {
			pending.entry = subtitleListEntry{files: files, expiresAt: time.Now().Add(subtitleListTTL)}
		}
		cache.mu.Lock()
		if err == nil {
			cache.folders.SetT(parent, pending.entry, subtitleListTTL)
		}
		delete(cache.loading, parent)
		close(pending.done)
		cache.mu.Unlock()
		return pending.entry, pending.err
	}
}

// ReadSmallFile descarga un archivo chico (subtítulos) entero. Lee como mucho
// maxBytes+1 bytes: si el resultado supera maxBytes, el llamador lo descarta.
func (s *Service) ReadSmallFile(ctx context.Context, fileID string, maxBytes int64) ([]byte, error) {
	resp, err := s.StreamMedia(ctx, fileID, "")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
}

// SubtitleVersionKey identifica la versión de un archivo de Drive para la caché.
func (f DriveFile) SubtitleVersionKey() string {
	return strings.Join([]string{f.ID, f.MD5Checksum, f.ModifiedTime.UTC().Format(time.RFC3339), strconv.FormatInt(f.Size, 10)}, ":")
}
