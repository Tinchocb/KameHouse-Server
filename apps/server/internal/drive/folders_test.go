package drive

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// fakeFolderDrive sirve files.get (metadatos) y files.list (hijos por página) de un árbol fijo.
// Mi unidad se pide como "root" (alias) pero su identificador real es "root-real".
func fakeFolderDrive(t *testing.T) *httptest.Server {
	t.Helper()
	metas := map[string]map[string]any{
		"root-real": {"id": "root-real", "name": "My Drive", "mimeType": folderMimeType},
		"series":    {"id": "series", "name": "Series", "mimeType": folderMimeType, "parents": []string{"root-real"}},
		"db":        {"id": "db", "name": "Dragon Ball", "mimeType": folderMimeType, "parents": []string{"series"}},
		"shared":    {"id": "shared", "name": "Compartida", "mimeType": folderMimeType, "parents": []string{"ghost"}},
		"video":     {"id": "video", "name": "ep01.mkv", "mimeType": "video/x-matroska", "parents": []string{"db"}},
		"atajo-carpeta": {
			"id": "atajo-carpeta", "name": "Atajo compartida", "mimeType": shortcutMimeType, "parents": []string{"root-real"},
			"shortcutDetails": map[string]string{"targetId": "shared", "targetMimeType": folderMimeType},
		},
		"atajo-archivo": {
			"id": "atajo-archivo", "name": "Atajo episodio", "mimeType": shortcutMimeType, "parents": []string{"root-real"},
			"shortcutDetails": map[string]string{"targetId": "video", "targetMimeType": "video/x-matroska"},
		},
	}
	// Hijos de cada carpeta, en páginas. Un listado sin "pageToken" es la primera página.
	pages := map[string][][]map[string]any{
		"root": {
			{metas["series"], metas["video"]},
			{metas["atajo-carpeta"], metas["atajo-archivo"]},
		},
		"series": {{metas["db"]}},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/files" {
			query := r.URL.Query()
			m := parentQuery.FindStringSubmatch(query.Get("q"))
			if len(m) != 2 {
				http.Error(w, "consulta sin carpeta padre", http.StatusBadRequest)
				return
			}
			if query.Get("orderBy") != "name" || query.Get("supportsAllDrives") != "true" {
				http.Error(w, "faltan parámetros del listado", http.StatusBadRequest)
				return
			}
			idx := 0
			if tok := query.Get("pageToken"); tok != "" {
				idx, _ = strconv.Atoi(tok)
			}
			resp := map[string]any{"files": []map[string]any{}}
			if pg := pages[m[1]]; idx < len(pg) {
				resp["files"] = pg[idx]
				if idx+1 < len(pg) {
					resp["nextPageToken"] = strconv.Itoa(idx + 1)
				}
			}
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		if id, ok := strings.CutPrefix(r.URL.Path, "/files/"); ok {
			if meta, found := metas[id]; found {
				_ = json.NewEncoder(w).Encode(meta)
				return
			}
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestListFoldersKeepsFoldersAndFolderShortcutsAcrossPages(t *testing.T) {
	c := testClient(fakeFolderDrive(t))
	folders, err := c.ListFolders(t.Context(), RootFolderID)
	require.NoError(t, err)
	require.Equal(t, []DriveFolder{
		{ID: "series", Name: "Series"},
		{ID: "shared", Name: "Atajo compartida"},
	}, folders, "los archivos de vídeo y los accesos directos a archivos quedan fuera")
}

func TestListFoldersRejectsUnsafeParentIDs(t *testing.T) {
	c := &Client{}
	_, err := c.ListFolders(t.Context(), "x' or trashed = true or '1'='1")
	require.Error(t, err)
}

func TestGetFolderAcceptsFoldersAndShortcutsToFolders(t *testing.T) {
	c := testClient(fakeFolderDrive(t))

	folder, err := c.GetFolder(t.Context(), "series")
	require.NoError(t, err)
	require.Equal(t, DriveFolder{ID: "series", Name: "Series"}, folder)

	viaShortcut, err := c.GetFolder(t.Context(), "atajo-carpeta")
	require.NoError(t, err)
	require.Equal(t, DriveFolder{ID: "shared", Name: "Atajo compartida"}, viaShortcut)

	_, err = c.GetFolder(t.Context(), "video")
	require.ErrorIs(t, err, ErrNotFolder)

	_, err = c.GetFolder(t.Context(), "no-existe")
	var apiErr *APIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, http.StatusNotFound, apiErr.Status)
}

func TestFolderPathStopsAtMyDriveAndAtAnInvisibleAncestor(t *testing.T) {
	c := testClient(fakeFolderDrive(t))

	path, err := c.FolderPath(t.Context(), "db")
	require.NoError(t, err)
	require.Equal(t, []DriveFolder{{ID: "series", Name: "Series"}, {ID: "db", Name: "Dragon Ball"}}, path)

	// El padre "ghost" no es visible: la ruta empieza en la carpeta compartida.
	path, err = c.FolderPath(t.Context(), "shared")
	require.NoError(t, err)
	require.Equal(t, []DriveFolder{{ID: "shared", Name: "Compartida"}}, path)

	path, err = c.FolderPath(t.Context(), "root-real")
	require.NoError(t, err)
	require.Empty(t, path, "Mi unidad no tiene ruta: la añade el llamador")
}
