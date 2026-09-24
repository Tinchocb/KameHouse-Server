package handlers

import (
	"strings"

	"kamehouse/internal/database/models/dto"
)

// localDiskDisconnected indica si el usuario desconectó el disco local
// (library.disableLocalScanning): la biblioteca pasa a ser solo Google Drive.
func (h *Handler) localDiskDisconnected() bool {
	s, err := h.App.Database.GetSettings()
	return err == nil && s != nil && s.Library.DisableLocalScanning
}

// visibleLocalFiles oculta los archivos del disco local cuando está desconectado.
// Solo filtra la vista: las filas siguen en la base y vuelven al reconectar. No usar
// el resultado para escribir con InsertLocalFiles, que borra lo que no recibe.
func (h *Handler) visibleLocalFiles(lfs []*dto.LocalFile) []*dto.LocalFile {
	if !h.localDiskDisconnected() {
		return lfs
	}
	out := make([]*dto.LocalFile, 0, len(lfs))
	for _, lf := range lfs {
		if lf != nil && strings.HasPrefix(lf.Path, "gdrive://") {
			out = append(out, lf)
		}
	}
	return out
}
