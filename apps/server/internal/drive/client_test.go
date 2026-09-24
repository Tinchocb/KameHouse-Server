package drive

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

type fakeItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	MimeType string `json:"mimeType"`
	Size     string `json:"size,omitempty"`
}

const folderMime = "application/vnd.google-apps.folder"

var parentQuery = regexp.MustCompile(`'([^']+)' in parents`)

// fakeDrive serves files.list for a static tree. Folder "root" returns its children in
// two pages; the first request for folder "z" is rate limited once.
func fakeDrive(t *testing.T, tree map[string][]fakeItem, failFolder string) (*httptest.Server, *atomic.Int32) {
	var calls atomic.Int32
	var rateLimited sync.Once
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path == "/files/vid1" {
			_ = json.NewEncoder(w).Encode(map[string]string{"thumbnailLink": "http://" + r.Host + "/thumb/vid1=s220"})
			return
		}
		if r.URL.Path == "/thumb/vid1=w480" {
			_, _ = w.Write([]byte("\xff\xd8\xff\xe0jpeg"))
			return
		}
		m := parentQuery.FindStringSubmatch(r.URL.Query().Get("q"))
		require.Len(t, m, 2)
		folder := m[1]
		if folder == failFolder {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"notFound"}`))
			return
		}
		if folder == "z" {
			hit := false
			rateLimited.Do(func() { hit = true })
			if hit {
				w.Header().Set("Retry-After", "0")
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
		}
		items := tree[folder]
		resp := map[string]any{"files": items}
		if folder == "root" {
			if r.URL.Query().Get("pageToken") == "" {
				resp = map[string]any{"files": items[:1], "nextPageToken": "p2"}
			} else {
				resp = map[string]any{"files": items[1:]}
			}
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func testClient(srv *httptest.Server) *Client {
	logger := zerolog.Nop()
	return &Client{httpClient: srv.Client(), apiBase: srv.URL, logger: &logger}
}

func testTree() map[string][]fakeItem {
	tree := map[string][]fakeItem{
		"root": {
			{ID: "dbz", Name: "Dragon Ball Z", MimeType: folderMime},
			{ID: "z", Name: "Kai", MimeType: folderMime},
			{ID: "poster", Name: "poster.jpg", MimeType: "image/jpeg"},
		},
		"z": {{ID: "k1", Name: "Kai - 01.mkv", MimeType: "video/x-matroska"}},
	}
	// Enough nested folders to keep all workers busy.
	var sagas []fakeItem
	for i := range 20 {
		id := fmt.Sprintf("saga%d", i)
		sagas = append(sagas, fakeItem{ID: id, Name: fmt.Sprintf("Saga %02d", i), MimeType: folderMime})
		tree[id] = []fakeItem{{ID: id + "-e1", Name: "E001.mkv", MimeType: "video/x-matroska"}}
	}
	tree["dbz"] = sagas
	return tree
}

func TestListVideoFilesParallel(t *testing.T) {
	srv, _ := fakeDrive(t, testTree(), "")
	c := testClient(srv)

	var folders, found atomic.Int32
	files, err := c.ListVideoFiles(context.Background(), "root", func(_ string, f []DriveFile, _ int) {
		folders.Add(1)
		found.Add(int32(len(f)))
	})
	require.NoError(t, err)
	require.Len(t, files, 21) // 20 sagas + Kai, poster filtered out
	require.EqualValues(t, 23, folders.Load())
	require.EqualValues(t, 21, found.Load())
	require.Equal(t, "Dragon Ball Z/Saga 00/E001.mkv", files[0].RelativePath)
	require.Equal(t, "Kai/Kai - 01.mkv", files[20].RelativePath) // sorted, retried after 429
}

func TestListVideoFilesAbortsOnError(t *testing.T) {
	srv, _ := fakeDrive(t, testTree(), "saga7")
	_, err := testClient(srv).ListVideoFiles(context.Background(), "root", nil)
	var apiErr *APIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, http.StatusNotFound, apiErr.Status)
}

func TestGetThumbnail(t *testing.T) {
	srv, _ := fakeDrive(t, nil, "")
	img, err := testClient(srv).GetThumbnail(context.Background(), "vid1", 480)
	require.NoError(t, err)
	require.Equal(t, "image/jpeg", http.DetectContentType(img))
}
