package mediastream

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/videofile"

	"github.com/samber/mo"
)

// DirectPlayOnly reporta Ajustes → Streaming → "solo directo". Con ese ajuste el servidor
// nunca arranca el encoder, ni por fallback tras un error de decodificación ni por cambio de pista.
// Es fail-closed: sin ajustes cargados se asume activo, así ningún camino arranca el encoder
// por un estado incompleto.
func (r *Repository) DirectPlayOnly() bool {
	return directPlayOnlyOf(r.GetSettings())
}

func directPlayOnlyOf(settings mo.Option[*models.MediastreamSettings]) bool {
	if s, ok := settings.Get(); ok && s != nil {
		return s.DirectPlayOnly
	}
	return true
}

// ResolveClientStreamType decide si un archivo se sirve en directo o en transcode para un cliente
// cuando la ruta NO pasa por RequestPlayback (hoy: archivos de Google Drive, gdrive://).
// Usa exactamente la misma politica y reglas que las rutas locales (resolveStreamType con la politica
// de los ajustes), para que un mismo archivo no se reproduzca distinto segun esté en disco o en Drive.
func (r *Repository) ResolveClientStreamType(requested StreamType, info *videofile.MediaInfo, caps *ClientCapabilities) StreamType {
	policy := playbackPolicy{directPlayOnly: r.DirectPlayOnly()}
	if s := r.GetSettings(); s.IsPresent() {
		if cfg := s.MustGet(); cfg != nil {
			policy.disableAutoSwitchToDirect = cfg.DisableAutoSwitchToDirectPlay
		}
	}

	resolved, reason := resolveStreamType(requested, info, caps, policy)
	if resolved != requested && r.logger != nil {
		r.logger.Info().
			Str("from", string(requested)).
			Str("to", string(resolved)).
			Str("reason", reason).
			Msg("mediastream: Drive stream type switched")
	}
	return resolved
}
