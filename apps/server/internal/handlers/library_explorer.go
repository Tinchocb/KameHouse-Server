package handlers

import (
	"sort"
	"strconv"

	"kamehouse/internal/database/models/dto"

	"github.com/labstack/echo/v4"
)

// HandleGetLibraryExplorerFileTree ...
//
//	@summary returns the file tree structure of the library directories.
//	@desc This returns a hierarchical representation of all directories and media files in the library.
//	@desc The tree includes LocalFile associations and media IDs for each file and directory.
//	@route /api/v1/library/explorer/file-tree [GET]
//	@returns library_explorer.FileTreeJSON
func (h *Handler) HandleGetLibraryExplorerFileTree(c echo.Context) error {

	if h.App.LibraryExplorer == nil {
		return h.RespondWithError(c, echo.NewHTTPError(500, "Library explorer is not initialized"))
	}

	// Get library paths from settings
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	libraryPaths := settings.GetLibrary().GetAllPaths()
	h.App.LibraryExplorer.SetLibraryPaths(libraryPaths)

	// Get file tree
	fileTree, err := h.App.LibraryExplorer.GetFileTree()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	limitStr := c.QueryParam("limit")
	offsetStr := c.QueryParam("offset")

	// Paginación segura para no saturar al cliente RSC con diccionarios de 10k elementos
	var limit, offset int
	if limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err != nil || l <= 0 {
			limit = 100
		} else {
			limit = l
		}
	} else {
		limit = 100
	}
	if offsetStr != "" {
		o, err := strconv.Atoi(offsetStr)
		if err != nil || o < 0 {
			offset = 0
		} else {
			offset = o
		}
	}
	if limit > 500 {
		limit = 500
	}

	keys := make([]string, 0, len(fileTree.LocalFiles))
	for k := range fileTree.LocalFiles {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	paginatedFiles := make(map[string]*dto.LocalFile)
	for i := offset; i < len(keys) && i < offset+limit; i++ {
		k := keys[i]
		paginatedFiles[k] = fileTree.LocalFiles[k]
	}

	// Crear una copia superficial del response tree para reemplazar el map gigante
	paginatedTree := *fileTree
	paginatedTree.LocalFiles = paginatedFiles

	return h.RespondWithData(c, paginatedTree)
}


// HandleRefreshLibraryExplorerFileTree ...
//
//	@summary refreshes the file tree structure of the library directories.
//	@desc This clears the cached file tree and rebuilds it from the current library state.
//	@desc Use this when the library structure has changed and you want to update the tree.
//	@route /api/v1/library/explorer/file-tree/refresh [POST]
//	@returns bool
func (h *Handler) HandleRefreshLibraryExplorerFileTree(c echo.Context) error {

	if h.App.LibraryExplorer == nil {
		return h.RespondWithError(c, echo.NewHTTPError(500, "Library explorer is not initialized"))
	}

	// Get library paths from settings
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	libraryPaths := settings.GetLibrary().GetAllPaths()
	h.App.LibraryExplorer.SetLibraryPaths(libraryPaths)

	// Refresh file tree
	err = h.App.LibraryExplorer.Refresh()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}
