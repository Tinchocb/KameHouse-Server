package drive

import (
	"context"
	"fmt"
	"io"
	"net/url"
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
	at    time.Time
	files []DriveFile
}

var (
	subtitleListMu    sync.Mutex
	subtitleListCache = map[string]subtitleListEntry{}
)

// ListSubtitleFiles devuelve los archivos .srt/.ass/.ssa/.vtt que están en la misma
// carpeta que el archivo `fileID` (no recorre subcarpetas).
func (c *Client) ListSubtitleFiles(ctx context.Context, fileID string) ([]DriveFile, error) {
	if !safeFileID(fileID) {
		return nil, fmt.Errorf("invalid drive file id %q", fileID)
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
		return nil, err
	}
	if len(meta.Parents) == 0 {
		return nil, nil
	}
	parent := meta.Parents[0]
	if !safeFileID(parent) {
		return nil, fmt.Errorf("invalid drive parent id %q", parent)
	}

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
	subtitleListMu.Lock()
	if e, ok := subtitleListCache[fileID]; ok && time.Since(e.at) < subtitleListTTL {
		subtitleListMu.Unlock()
		return e.files, nil
	}
	subtitleListMu.Unlock()

	client, err := s.GetClient()
	if err != nil {
		return nil, err
	}
	files, err := client.ListSubtitleFiles(ctx, fileID)
	if err != nil {
		return nil, err
	}

	subtitleListMu.Lock()
	if len(subtitleListCache) > 256 {
		subtitleListCache = map[string]subtitleListEntry{}
	}
	subtitleListCache[fileID] = subtitleListEntry{at: time.Now(), files: files}
	subtitleListMu.Unlock()
	return files, nil
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
