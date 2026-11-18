package drive

import (
	"context"
	"errors"
	"fmt"
	"net/url"
)

const (
	folderMimeType   = "application/vnd.google-apps.folder"
	shortcutMimeType = "application/vnd.google-apps.shortcut"

	// RootFolderID es el alias que Drive usa para "Mi unidad".
	RootFolderID = "root"
	// RootFolderName es como se muestra Mi unidad en el selector de carpetas.
	RootFolderName = "Mi unidad"

	maxFolderPages = 20
	maxFolderDepth = 20
)

// ErrNotFolder marca un identificador de Drive que existe pero no es una carpeta.
var ErrNotFolder = errors.New("el enlace no es una carpeta de Google Drive")

// apiFolderMeta modela los metadatos de un archivo de Drive, con sus carpetas padre.
type apiFolderMeta struct {
	ID              string              `json:"id"`
	Name            string              `json:"name"`
	MimeType        string              `json:"mimeType"`
	Parents         []string            `json:"parents"`
	ShortcutDetails *apiShortcutDetails `json:"shortcutDetails"`
}

// ListFolders devuelve las subcarpetas de una carpeta, ordenadas por nombre. Incluye los accesos
// directos a carpetas (con el identificador de la carpeta a la que apuntan). parentID debe ser
// un identificador válido de Drive; RootFolderID es Mi unidad.
func (c *Client) ListFolders(ctx context.Context, parentID string) ([]DriveFolder, error) {
	if !safeFileID(parentID) {
		return nil, fmt.Errorf("invalid drive folder id %q", parentID)
	}
	folders := []DriveFolder{}
	pageToken := ""
	for page := 0; page < maxFolderPages; page++ {
		u, _ := url.Parse(c.api("/files"))
		q := u.Query()
		q.Set("q", fmt.Sprintf("'%s' in parents and (mimeType = '%s' or mimeType = '%s') and trashed = false",
			parentID, folderMimeType, shortcutMimeType))
		q.Set("fields", "nextPageToken, files(id, name, mimeType, shortcutDetails(targetId, targetMimeType))")
		q.Set("orderBy", "name")
		q.Set("pageSize", "1000")
		q.Set("supportsAllDrives", "true")
		q.Set("includeItemsFromAllDrives", "true")
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}
		u.RawQuery = q.Encode()

		var res apiFilesResponse
		if err := c.getJSON(ctx, u.String(), &res); err != nil {
			return nil, err
		}
		for _, item := range res.Files {
			id := item.ID
			switch item.MimeType {
			case folderMimeType:
			case shortcutMimeType:
				if item.ShortcutDetails == nil || item.ShortcutDetails.TargetMimeType != folderMimeType || item.ShortcutDetails.TargetID == "" {
					continue
				}
				id = item.ShortcutDetails.TargetID
			default:
				continue
			}
			folders = append(folders, DriveFolder{ID: id, Name: item.Name})
		}
		pageToken = res.NextPageToken
		if pageToken == "" {
			break
		}
	}
	return folders, nil
}

// GetFolder devuelve una carpeta de Drive por su identificador. Acepta también un acceso directo
// a una carpeta (se usa la carpeta a la que apunta). Falla con ErrNotFolder si no es una carpeta.
func (c *Client) GetFolder(ctx context.Context, folderID string) (DriveFolder, error) {
	meta, err := c.folderMeta(ctx, folderID)
	if err != nil {
		return DriveFolder{}, err
	}
	if meta.MimeType == shortcutMimeType && meta.ShortcutDetails != nil && meta.ShortcutDetails.TargetMimeType == folderMimeType {
		return DriveFolder{ID: meta.ShortcutDetails.TargetID, Name: meta.Name}, nil
	}
	if meta.MimeType != folderMimeType {
		return DriveFolder{}, ErrNotFolder
	}
	return DriveFolder{ID: meta.ID, Name: meta.Name}, nil
}

// FolderPath devuelve la ruta de una carpeta desde Mi unidad hasta ella, incluida y sin la propia
// raíz. Si un ancestro no es visible (por ejemplo, una carpeta compartida contigo), la ruta
// empieza en el ancestro más alto que sí se puede leer.
func (c *Client) FolderPath(ctx context.Context, id string) ([]DriveFolder, error) {
	path := []DriveFolder{}
	cur := id
	for depth := 0; depth < maxFolderDepth; depth++ {
		meta, err := c.folderMeta(ctx, cur)
		if err != nil {
			if depth == 0 {
				return nil, err
			}
			break
		}
		if len(meta.Parents) == 0 {
			// Raíz de Mi unidad o de una unidad compartida: el selector ya muestra Mi unidad.
			break
		}
		path = append([]DriveFolder{{ID: meta.ID, Name: meta.Name}}, path...)
		cur = meta.Parents[0]
	}
	return path, nil
}

// folderMeta pide los metadatos de un archivo de Drive.
func (c *Client) folderMeta(ctx context.Context, id string) (*apiFolderMeta, error) {
	if !safeFileID(id) {
		return nil, fmt.Errorf("invalid drive folder id %q", id)
	}
	u, _ := url.Parse(c.api("/files/" + id))
	q := u.Query()
	q.Set("fields", "id, name, mimeType, parents, shortcutDetails(targetId, targetMimeType)")
	q.Set("supportsAllDrives", "true")
	u.RawQuery = q.Encode()

	var meta apiFolderMeta
	if err := c.getJSON(ctx, u.String(), &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}
