package drive

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func fakeSubtitleDrive(t *testing.T, calls *atomic.Int32) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		switch {
		case r.URL.Path == "/files/vid1":
			_ = json.NewEncoder(w).Encode(map[string]any{"parents": []string{"folderA"}})
		case r.URL.Path == "/files/orphan":
			_ = json.NewEncoder(w).Encode(map[string]any{})
		case r.URL.Path == "/files" && strings.Contains(r.URL.Query().Get("q"), "'folderA' in parents"):
			require.Contains(t, r.URL.Query().Get("q"), "name contains '.srt'")
			_ = json.NewEncoder(w).Encode(map[string]any{"files": []map[string]string{
				{"id": "s1", "name": "Ep 01.es.srt", "size": "12", "modifiedTime": "2026-01-02T03:04:05Z"},
				{"id": "s2", "name": "Ep 01.en.ass", "size": "30"},
			}})
		case r.URL.Path == "/files/s1" && r.URL.Query().Get("alt") == "media":
			_, _ = w.Write([]byte("hola mundo...."))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestListSubtitleFiles(t *testing.T) {
	var calls atomic.Int32
	srv := fakeSubtitleDrive(t, &calls)
	c := testClient(srv)

	files, err := c.ListSubtitleFiles(context.Background(), "vid1")
	require.NoError(t, err)
	require.Len(t, files, 2)
	require.Equal(t, "Ep 01.es.srt", files[0].Name)
	require.Equal(t, int64(12), files[0].Size)
	require.Contains(t, files[0].SubtitleVersionKey(), "s1:")

	files, err = c.ListSubtitleFiles(context.Background(), "orphan")
	require.NoError(t, err)
	require.Empty(t, files)

	_, err = c.ListSubtitleFiles(context.Background(), "bad id/..")
	require.Error(t, err)
}

func TestServiceSiblingSubtitleFilesCachesAndReads(t *testing.T) {
	var calls atomic.Int32
	srv := fakeSubtitleDrive(t, &calls)
	logger := zerolog.Nop()
	svc := &Service{logger: &logger, enabled: true, folderID: "root", client: testClient(srv)}

	subtitleListMu.Lock()
	subtitleListCache = map[string]subtitleListEntry{}
	subtitleListMu.Unlock()

	_, err := svc.SiblingSubtitleFiles(context.Background(), "vid1")
	require.NoError(t, err)
	after := calls.Load()
	_, err = svc.SiblingSubtitleFiles(context.Background(), "vid1")
	require.NoError(t, err)
	require.Equal(t, after, calls.Load(), "el segundo listado sale de la caché")

	data, err := svc.ReadSmallFile(context.Background(), "s1", 1024)
	require.NoError(t, err)
	require.Equal(t, "hola mundo....", string(data))

	data, err = svc.ReadSmallFile(context.Background(), "s1", 4)
	require.NoError(t, err)
	require.Len(t, data, 5, "lee maxBytes+1 para que el llamador detecte el exceso")
}
