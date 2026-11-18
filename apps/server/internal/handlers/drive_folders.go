package handlers

import (
	"errors"
	"net/http"

	"kamehouse/internal/drive"

	"github.com/labstack/echo/v4"
)

// driveClient devuelve el cliente de Drive si la cuenta está conectada.
func (h *Handler) driveClient() (*drive.Client, error) {
	if h.App.DriveService == nil {
		return nil, errDriveNotConnected
	}
	client, err := h.App.DriveService.GetClient()
	if err != nil {
		return nil, errDriveNotConnected
	}
	return client, nil
}

// HandleDriveFolders lista las subcarpetas de una carpeta de Drive para elegir la de la biblioteca,
// sin copiar identificadores a mano. Devuelve también la ruta hasta la carpeta (migas de pan).
//
//	@summary lists the subfolders of a Google Drive folder for the folder picker.
//	@route /api/v1/drive/folders [GET]
func (h *Handler) HandleDriveFolders(c echo.Context) error {
	parentID := c.QueryParam("parentId")
	if parentID == "" {
		parentID = drive.RootFolderID
	}
	if !drive.ValidFileID(parentID) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("identificador de carpeta no válido"))
	}
	client, err := h.driveClient()
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}

	ctx := c.Request().Context()
	folders, err := client.ListFolders(ctx, parentID)
	if err != nil {
		h.App.Logger.Warn().Err(err).Str("parentId", parentID).Msg("drive: no se pudieron listar las carpetas")
		return h.RespondWithCodeError(c, http.StatusBadGateway, errors.New("no se pudieron leer las carpetas de Google Drive"))
	}

	path := []drive.DriveFolder{{ID: drive.RootFolderID, Name: drive.RootFolderName}}
	if parentID != drive.RootFolderID {
		ancestors, err := client.FolderPath(ctx, parentID)
		if err != nil {
			h.App.Logger.Warn().Err(err).Str("parentId", parentID).Msg("drive: no se pudo leer la ruta de la carpeta")
		}
		path = append(path, ancestors...)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"parentId": parentID,
		"path":     path,
		"folders":  folders,
	})
}

// HandleDriveSelectFolder guarda la carpeta de la biblioteca (elegida en el selector o pegada como
// enlace), comprueba que sea una carpeta de la cuenta conectada y arranca un escaneo.
//
//	@summary saves the Google Drive library folder and starts a scan.
//	@route /api/v1/drive/folder [PUT]
func (h *Handler) HandleDriveSelectFolder(c echo.Context) error {
	var body struct {
		FolderID string `json:"folderId"`
	}
	if err := c.Bind(&body); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}
	folderID := drive.CleanFolderID(body.FolderID)
	if !drive.ValidFileID(folderID) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("el enlace de la carpeta no es válido"))
	}
	client, err := h.driveClient()
	if err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}

	folder, err := client.GetFolder(c.Request().Context(), folderID)
	if err != nil {
		var apiErr *drive.APIError
		switch {
		case errors.Is(err, drive.ErrNotFolder):
			return h.RespondWithCodeError(c, http.StatusBadRequest, err)
		case errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound:
			return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("no encontramos esa carpeta en tu Google Drive"))
		}
		h.App.Logger.Warn().Err(err).Str("folderId", folderID).Msg("drive: no se pudo leer la carpeta elegida")
		return h.RespondWithCodeError(c, http.StatusBadGateway, errors.New("no se pudo consultar la carpeta en Google Drive"))
	}

	// Mi unidad se guarda como "root": el alias sigue valiendo aunque cambie su identificador real.
	storedID, name := folder.ID, folder.Name
	if folderID == drive.RootFolderID {
		storedID, name = drive.RootFolderID, drive.RootFolderName
	}

	cached, err := h.App.Database.GetStoredSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	// Copia: GetStoredSettings devuelve el puntero cacheado y compartido.
	updated := *cached
	settings := &updated
	settings.GoogleDrive.FolderID = storedID
	settings.GoogleDrive.FolderName = name
	if _, err := h.App.Database.UpsertSettings(settings); err != nil {
		return h.RespondWithError(c, err)
	}
	h.applyDriveConfig()
	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", settings.Redacted())

	// Elegir carpeta es una decisión explícita: se escanea enseguida. Si ya hay un escaneo en
	// curso, la sincronización automática lo retoma cuando termine (la carpeta cambió).
	scanStarted := h.startDriveScan(false) == nil
	return h.RespondWithData(c, map[string]interface{}{
		"folderId":    storedID,
		"folderName":  name,
		"scanStarted": scanStarted,
	})
}
