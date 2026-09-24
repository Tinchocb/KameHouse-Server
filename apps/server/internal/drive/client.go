package drive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/oauth2"
)

const (
	driveAPIBase = "https://www.googleapis.com/drive/v3"
	oauthInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"
)

// Client wraps Google Drive API calls with automatic OAuth2 token refreshing.
type Client struct {
	httpClient  *http.Client
	transport   *http.Transport
	tokenSource oauth2.TokenSource
	logger      *zerolog.Logger
	apiBase     string // overridable in tests; empty means driveAPIBase
}

func (c *Client) api(path string) string {
	if c.apiBase != "" {
		return c.apiBase + path
	}
	return driveAPIBase + path
}

// Close closes any idle HTTP connections maintained by the client.
func (c *Client) Close() {
	if c.transport != nil {
		c.transport.CloseIdleConnections()
	}
}

// NewClient creates an authenticated Google Drive client using a refresh token.
func NewClient(clientID, clientSecret, refreshToken string, logger *zerolog.Logger) (*Client, error) {
	if clientID == "" || clientSecret == "" || refreshToken == "" {
		return nil, fmt.Errorf("clientID, clientSecret and refreshToken are required to initialize Drive client")
	}

	config := GetOAuthConfig(clientID, clientSecret, "")
	initialToken := &oauth2.Token{
		RefreshToken: refreshToken,
	}

	tokenSource := config.TokenSource(context.Background(), initialToken)
	reusingTokenSource := oauth2.ReuseTokenSource(initialToken, tokenSource)

	baseTransport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	oauthTransport := &oauth2.Transport{
		Source: reusingTokenSource,
		Base:   baseTransport,
	}

	httpClient := &http.Client{
		Transport: oauthTransport,
		Timeout:   0, // No timeout for media streaming chunks
	}

	return &Client{
		httpClient:  httpClient,
		transport:   baseTransport,
		tokenSource: reusingTokenSource,
		logger:      logger,
	}, nil
}

// apiFilesResponse models the files.list Google Drive API v3 JSON response.
type apiFilesResponse struct {
	NextPageToken string        `json:"nextPageToken"`
	Files         []apiFileItem `json:"files"`
}

type apiFileItem struct {
	ID                 string              `json:"id"`
	Name               string              `json:"name"`
	Size               string              `json:"size"`
	MimeType           string              `json:"mimeType"`
	ModifiedTime       time.Time           `json:"modifiedTime"`
	MD5Checksum        string              `json:"md5Checksum"`
	VideoMediaMetadata *apiVideoMetadata  `json:"videoMediaMetadata"`
	ShortcutDetails    *apiShortcutDetails `json:"shortcutDetails"`
}

type apiShortcutDetails struct {
	TargetID       string `json:"targetId"`
	TargetMimeType string `json:"targetMimeType"`
}

type apiVideoMetadata struct {
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	DurationMillis string `json:"durationMillis"`
}

// ListProgressFunc is called after each folder is fully listed with the folder's relative
// path, the video files found in it, and how many folders are still queued. Calls are
// serialized, never concurrent.
type ListProgressFunc func(folderPath string, found []DriveFile, foldersPending int)

// listWorkers bounds concurrent files.list calls. Drive's per-user quota comfortably
// allows this; rate-limit responses are retried with backoff in getJSON.
const listWorkers = 6

type folderTask struct {
	id       string
	pathBase string
}

// ListVideoFiles recursively traverses the given folderID and returns all video files,
// sorted by relative path. Folders are listed concurrently. onFolder may be nil.
func (c *Client) ListVideoFiles(ctx context.Context, rootFolderID string, onFolder ListProgressFunc) ([]DriveFile, error) {
	if strings.TrimSpace(rootFolderID) == "" {
		return nil, fmt.Errorf("rootFolderID cannot be empty")
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var (
		mu       sync.Mutex
		cond     = sync.NewCond(&mu)
		queue    = []folderTask{{id: rootFolderID}}
		visited  = map[string]bool{rootFolderID: true}
		inFlight = 1 // queued + being listed; 0 means the tree is exhausted
		allFiles []DriveFile
		firstErr error
	)

	worker := func() {
		for {
			mu.Lock()
			for len(queue) == 0 && inFlight > 0 && firstErr == nil {
				cond.Wait()
			}
			if inFlight == 0 || firstErr != nil {
				mu.Unlock()
				return
			}
			task := queue[0]
			queue = queue[1:]
			mu.Unlock()

			files, subfolders, err := c.listFolder(ctx, task)

			mu.Lock()
			inFlight--
			if err != nil {
				if firstErr == nil {
					firstErr = err
					cancel()
				}
			} else {
				for _, sf := range subfolders {
					if !visited[sf.id] {
						visited[sf.id] = true
						queue = append(queue, sf)
						inFlight++
					}
				}
				allFiles = append(allFiles, files...)
				if onFolder != nil {
					onFolder(task.pathBase, files, len(queue))
				}
			}
			mu.Unlock()
			cond.Broadcast()
		}
	}

	var wg sync.WaitGroup
	for i := 0; i < listWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			worker()
		}()
	}
	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	// Workers finish in arbitrary order; keep the result deterministic because the
	// indexer uses list position as the fallback episode number.
	sort.Slice(allFiles, func(i, j int) bool { return allFiles[i].RelativePath < allFiles[j].RelativePath })
	return allFiles, nil
}

// listFolder lists one folder (all pages), returning its video files and subfolders.
func (c *Client) listFolder(ctx context.Context, task folderTask) ([]DriveFile, []folderTask, error) {
	var files []DriveFile
	var subfolders []folderTask
	join := func(name string) string {
		if task.pathBase == "" {
			return name
		}
		return task.pathBase + "/" + name
	}

	pageToken := ""
	for {
		u, _ := url.Parse(c.api("/files"))
		q := u.Query()
		q.Set("q", fmt.Sprintf("'%s' in parents and trashed = false", task.id))
		q.Set("fields", "nextPageToken, files(id, name, size, mimeType, modifiedTime, md5Checksum, videoMediaMetadata, shortcutDetails(targetId, targetMimeType))")
		q.Set("pageSize", "1000")
		q.Set("supportsAllDrives", "true")
		q.Set("includeItemsFromAllDrives", "true")
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}
		u.RawQuery = q.Encode()

		var result apiFilesResponse
		if err := c.getJSON(ctx, u.String(), &result); err != nil {
			return nil, nil, err
		}

		for _, item := range result.Files {
			actualID := item.ID
			actualMimeType := item.MimeType
			if item.MimeType == "application/vnd.google-apps.shortcut" && item.ShortcutDetails != nil {
				if item.ShortcutDetails.TargetID != "" {
					actualID = item.ShortcutDetails.TargetID
				}
				if item.ShortcutDetails.TargetMimeType != "" {
					actualMimeType = item.ShortcutDetails.TargetMimeType
				}
			}

			if actualMimeType == "application/vnd.google-apps.folder" {
				subfolders = append(subfolders, folderTask{id: actualID, pathBase: join(item.Name)})
				continue
			}

			size, _ := strconv.ParseInt(item.Size, 10, 64)
			df := DriveFile{
				ID:           actualID,
				Name:         item.Name,
				Size:         size,
				MimeType:     actualMimeType,
				ModifiedTime: item.ModifiedTime,
				MD5Checksum:  item.MD5Checksum,
				RelativePath: join(item.Name),
			}
			if item.VideoMediaMetadata != nil {
				df.Width = item.VideoMediaMetadata.Width
				df.Height = item.VideoMediaMetadata.Height
				if dm, err := strconv.ParseInt(item.VideoMediaMetadata.DurationMillis, 10, 64); err == nil {
					df.DurationMillis = dm
				}
			}
			if df.IsVideo() {
				files = append(files, df)
			}
		}

		pageToken = result.NextPageToken
		if pageToken == "" {
			return files, subfolders, nil
		}
	}
}

// getJSON performs an authenticated GET and decodes the JSON body, retrying with
// exponential backoff on rate limits (429, 403 *RateLimitExceeded) and 5xx errors.
func (c *Client) getJSON(ctx context.Context, rawURL string, out any) error {
	const maxAttempts = 5
	backoff := 500 * time.Millisecond
	for attempt := 1; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			return err
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("drive api request failed: %w", err)
		}
		if resp.StatusCode == http.StatusOK {
			err = json.NewDecoder(resp.Body).Decode(out)
			_ = resp.Body.Close()
			if err != nil {
				return fmt.Errorf("failed to decode drive api response: %w", err)
			}
			return nil
		}

		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if !isRetryableDriveError(resp.StatusCode, body) || attempt == maxAttempts {
			return &APIError{Status: resp.StatusCode, Body: string(body)}
		}
		wait := backoff + time.Duration(rand.Int64N(int64(backoff/2)))
		if ra, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && ra > 0 {
			wait = time.Duration(ra) * time.Second
		}
		c.logger.Debug().Int("status", resp.StatusCode).Dur("wait", wait).Int("attempt", attempt).Msg("drive: Retrying rate-limited request")
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
		}
		backoff *= 2
	}
}

// APIError is a non-2xx Drive API response.
type APIError struct {
	Status int
	Body   string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("drive api returned error %d: %s", e.Status, e.Body)
}

func isRetryableDriveError(status int, body []byte) bool {
	switch {
	case status == http.StatusTooManyRequests, status >= 500:
		return true
	case status == http.StatusForbidden:
		b := string(body)
		return strings.Contains(b, "rateLimitExceeded") || strings.Contains(b, "userRateLimitExceeded")
	}
	return false
}

// GetFile retrieves metadata for a single Google Drive file (resolving shortcuts if needed).
func (c *Client) GetFile(ctx context.Context, fileID string) (*DriveFile, error) {
	u, _ := url.Parse(c.api("/files/" + fileID))
	q := u.Query()
	q.Set("fields", "id, name, size, mimeType, modifiedTime, md5Checksum, videoMediaMetadata, shortcutDetails(targetId, targetMimeType)")
	q.Set("supportsAllDrives", "true")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("drive api returned status %d: %s", resp.StatusCode, string(b))
	}

	var item apiFileItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, err
	}

	actualID := item.ID
	actualMimeType := item.MimeType
	if item.MimeType == "application/vnd.google-apps.shortcut" && item.ShortcutDetails != nil {
		if item.ShortcutDetails.TargetID != "" {
			actualID = item.ShortcutDetails.TargetID
		}
		if item.ShortcutDetails.TargetMimeType != "" {
			actualMimeType = item.ShortcutDetails.TargetMimeType
		}
	}

	size, _ := strconv.ParseInt(item.Size, 10, 64)
	df := &DriveFile{
		ID:           actualID,
		Name:         item.Name,
		Size:         size,
		MimeType:     actualMimeType,
		ModifiedTime: item.ModifiedTime,
		MD5Checksum:  item.MD5Checksum,
		RelativePath: item.Name,
	}
	if item.VideoMediaMetadata != nil {
		df.Width = item.VideoMediaMetadata.Width
		df.Height = item.VideoMediaMetadata.Height
		if dm, err := strconv.ParseInt(item.VideoMediaMetadata.DurationMillis, 10, 64); err == nil {
			df.DurationMillis = dm
		}
	}
	return df, nil
}

// GetMediaStream streams media bytes directly from Google Drive, forwarding HTTP Range headers.
// The caller is responsible for closing the returned Response.Body.
func (c *Client) GetMediaStream(ctx context.Context, fileID string, rangeHeader string) (*http.Response, error) {
	streamURL := c.api(fmt.Sprintf("/files/%s?alt=media&supportsAllDrives=true", fileID))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, streamURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create media stream request: %w", err)
	}

	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to stream media from drive: %w", err)
	}

	// If Google Drive returns 403 / fileNotDownloadable, fileID may be a shortcut ID
	if resp.StatusCode == http.StatusForbidden {
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		bodyStr := string(body)
		if strings.Contains(bodyStr, "fileNotDownloadable") || strings.Contains(bodyStr, "Only files with binary content") {
			// Resolve actual target ID from shortcut metadata
			if target, err := c.GetFile(ctx, fileID); err == nil && target != nil && target.ID != "" && target.ID != fileID {
				return c.GetMediaStream(ctx, target.ID, rangeHeader)
			}
		}
		return nil, fmt.Errorf("drive stream returned error status %d: %s", resp.StatusCode, bodyStr)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, fmt.Errorf("drive stream returned error status %d: %s", resp.StatusCode, string(body))
	}

	return resp, nil
}

// GetUserInfo returns profile information of the authenticated user to verify credentials.
func (c *Client) GetUserInfo(ctx context.Context) (email string, name string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, oauthInfoURL, nil)
	if err != nil {
		return "", "", err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("failed to get user info: status %d: %s", resp.StatusCode, string(b))
	}

	var data struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", "", err
	}
	return data.Email, data.Name, nil
}

// ErrNoThumbnail means Drive has not generated a thumbnail for the file (yet).
var ErrNoThumbnail = errors.New("drive: file has no thumbnail")

var thumbnailSizeSuffix = regexp.MustCompile(`=s\d+$`)

// GetThumbnail downloads Drive's own preview frame for a video, scaled to width px.
// Drive generates these server-side, so no bytes of the video itself are fetched.
func (c *Client) GetThumbnail(ctx context.Context, fileID string, width int) ([]byte, error) {
	u, _ := url.Parse(c.api("/files/" + fileID))
	q := u.Query()
	q.Set("fields", "thumbnailLink")
	q.Set("supportsAllDrives", "true")
	u.RawQuery = q.Encode()

	var meta struct {
		ThumbnailLink string `json:"thumbnailLink"`
	}
	if err := c.getJSON(ctx, u.String(), &meta); err != nil {
		return nil, err
	}
	if meta.ThumbnailLink == "" {
		return nil, ErrNoThumbnail
	}

	// thumbnailLink ends in "=s220"; ask for a larger rendition instead.
	link := thumbnailSizeSuffix.ReplaceAllString(meta.ThumbnailLink, fmt.Sprintf("=w%d", width))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, link, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("drive thumbnail request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNoThumbnail
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("drive thumbnail returned status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 5<<20))
}
