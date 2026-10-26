package handlers

import (
	"context"
	"time"

	"kamehouse/internal/mediastream"
	"kamehouse/internal/mediastream/extsubs"
	"kamehouse/internal/mediastream/videofile"
)

// driveSubtitleBudget acota el tiempo total (listar la carpeta + bajar los archivos
// chicos) que la reproducción espera por subtítulos externos de Drive. Si se agota,
// el episodio abre igual, sin esas pistas.
const driveSubtitleBudget = 8 * time.Second

// withExternalSubtitles devuelve una copia del container con los subtítulos externos
// de un video local (.srt/.ass/.ssa/.vtt junto al archivo, en Subs/…) sumados a los
// embebidos. No modifica el container recibido: es el compartido de la caché de
// playback.
func (h *Handler) withExternalSubtitles(mc *mediastream.MediaContainer, mediaPath string) *mediastream.MediaContainer {
	if mc == nil || mc.MediaInfo == nil {
		return mc
	}
	cacheDir := h.App.MediastreamRepository.CacheDir()
	if cacheDir == "" {
		return mc
	}
	out, err := withLocalExternalSubtitles(cacheDir, mc, mediaPath)
	if err != nil {
		h.App.Logger.Warn().Err(err).Str("path", mediaPath).Msg("subtitles: no se pudieron preparar los subtítulos externos")
		return mc
	}
	return out
}

func withLocalExternalSubtitles(cacheDir string, mc *mediastream.MediaContainer, mediaPath string) (*mediastream.MediaContainer, error) {
	subs, err := extsubs.Sync(cacheDir, mediaPath, extsubs.LocalSources(mediaPath))
	if err != nil || len(subs) == 0 {
		return mc, err
	}
	out := *mc
	mi := *mc.MediaInfo
	mi.Subtitles = appendExternalSubtitles(mi.Subtitles, subs)
	out.MediaInfo = &mi
	return &out, nil
}

// addDriveExternalSubtitles suma al container público de un archivo de Drive los
// subtítulos que están en su misma carpeta con el mismo nombre base. `out.MediaInfo`
// debe ser una copia privada (publicDriveContainer ya la hace).
func (h *Handler) addDriveExternalSubtitles(ctx context.Context, out *mediastream.MediaContainer, drivePath, fileID, fileName string) {
	if out == nil || out.MediaInfo == nil || h.App.DriveService == nil || !h.App.DriveService.IsEnabled() {
		return
	}
	cacheDir := h.App.MediastreamRepository.CacheDir()
	if cacheDir == "" {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, driveSubtitleBudget)
	defer cancel()

	files, err := h.App.DriveService.SiblingSubtitleFiles(ctx, fileID)
	if err != nil {
		h.App.Logger.Warn().Err(err).Str("fileId", fileID).Msg("subtitles: no se pudo listar los subtítulos de la carpeta de Drive")
		return
	}
	byName := make(map[string]int, len(files))
	names := make([]string, 0, len(files))
	for i, f := range files {
		// Nombres repetidos en la carpeta (Drive lo permite): gana el primero.
		if _, dup := byName[f.Name]; !dup {
			byName[f.Name] = i
			names = append(names, f.Name)
		}
	}

	var sources []extsubs.Source
	for _, cand := range extsubs.MatchVideo(fileName, names) {
		f := files[byName[cand.Name]]
		id := f.ID
		sources = append(sources, extsubs.Source{
			Candidate: cand,
			Key:       f.SubtitleVersionKey(),
			Read:      func() ([]byte, error) { return h.App.DriveService.ReadSmallFile(ctx, id, extsubs.MaxFileSize) },
		})
	}

	subs, err := extsubs.Sync(cacheDir, drivePath, sources)
	if err != nil {
		h.App.Logger.Warn().Err(err).Str("fileId", fileID).Msg("subtitles: no se pudieron preparar los subtítulos externos de Drive")
		return
	}
	out.MediaInfo.Subtitles = appendExternalSubtitles(out.MediaInfo.Subtitles, subs)
}

// appendExternalSubtitles agrega las pistas externas tras las embebidas, en una
// lista nueva (nunca sobre el slice del container compartido).
func appendExternalSubtitles(embedded, external []videofile.Subtitle) []videofile.Subtitle {
	if len(external) == 0 {
		return embedded
	}
	out := make([]videofile.Subtitle, 0, len(embedded)+len(external))
	out = append(out, embedded...)
	return append(out, external...)
}
