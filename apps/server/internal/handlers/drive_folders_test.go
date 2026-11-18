package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kamehouse/internal/core"
	"kamehouse/internal/drive"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

// driveFolderHandler devuelve un handler con Drive sin conectar: las rutas de carpetas deben
// rechazar la petición antes de hablar con Google.
func driveFolderHandler(t *testing.T) *Handler {
	t.Helper()
	l := zerolog.Nop()
	a := &core.App{CoreServices: core.CoreServices{Logger: &l}}
	a.DriveService = drive.NewService(&l)
	return &Handler{App: a}
}

func TestDriveFoldersNeedAConnectedAccount(t *testing.T) {
	h := driveFolderHandler(t)
	rec := httptest.NewRecorder()
	require.NoError(t, h.HandleDriveFolders(echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/drive/folders", nil), rec)))
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "conecta tu cuenta")
}

func TestDriveFoldersRejectUnsafeParentIDs(t *testing.T) {
	h := driveFolderHandler(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/drive/folders?parentId=a%27b", nil)
	require.NoError(t, h.HandleDriveFolders(echo.New().NewContext(req, rec)))
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "no válido")
}

func TestDriveSelectFolderValidatesTheLinkBeforeUsingDrive(t *testing.T) {
	h := driveFolderHandler(t)
	put := func(body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPut, "/api/v1/drive/folder", strings.NewReader(body))
		req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
		rec := httptest.NewRecorder()
		require.NoError(t, h.HandleDriveSelectFolder(echo.New().NewContext(req, rec)))
		return rec
	}

	rec := put(`{"folderId":"carpeta con espacios"}`)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "no es válido")

	// Un enlace completo se reduce al identificador antes de validar; sin cuenta conectada, 400.
	rec = put(`{"folderId":"https://drive.google.com/drive/folders/1AbC_dEf-GhI?usp=sharing"}`)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "conecta tu cuenta")
}
