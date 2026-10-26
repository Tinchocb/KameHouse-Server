package mediastream

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"

	"kamehouse/internal/mkvsubs"
)

// Por qué falla la lectura por ventanas. Distinguir las dos familias es lo que evita el
// "a veces sí, a veces no":
//
//   - El archivo no admite la lectura por ventanas (no es Matroska, no tiene Cues, la
//     pista es de imagen...): es definitivo. Queda la extracción completa con botón.
//   - La lectura falló (Drive limitó las descargas, sin red, 5xx...): es pasajero. Se
//     reintenta solo y se le muestra al usuario, sin cambiar lo que ofrece la pista.

// Motivos definitivos (DriveWindowUnavailableError.Reason y razones por pista).
const (
	WindowReasonNotMatroska   = "not-matroska"   // mp4, webm sin firma Matroska...
	WindowReasonNoTracks      = "no-tracks"      // el archivo no trae el elemento Tracks
	WindowReasonNoCues        = "no-cues"        // sin índice: no se puede saltar a un instante
	WindowReasonNoTextTracks  = "no-text-tracks" // solo hay pistas de imagen o de un códec que no se lee
	WindowReasonNotConfigured = "not-configured" // el servidor no tiene fuente de Drive registrada
	WindowReasonImage         = "image"          // pista de imagen (PGS, DVB...)
	WindowReasonCodec         = "codec"          // el códec de la pista no coincide con lo que dijo ffprobe
	WindowReasonTrackMissing  = "track-missing"  // ffprobe ve una pista que el archivo no tiene en ese orden
	WindowReasonBroken        = "broken-layout"  // el índice del archivo no coincide con su contenido
)

// Motivos de falla de lectura (DriveReadError.Kind): los de drive.ErrKind* más estos.
const (
	ReadKindFormat   = "format"   // la estructura del archivo no es la esperada
	ReadKindCanceled = "canceled" // la lectura se canceló (el reproductor se movió o se fue)
)

var (
	// ErrDriveWindowUnavailable: este archivo no se puede leer por ventanas; queda la
	// extracción completa.
	ErrDriveWindowUnavailable = errors.New("windowed subtitle extraction not available for this file")
	// ErrDriveWindowReadFailed: no se pudo leer el archivo ahora (Drive, red). Es pasajero.
	ErrDriveWindowReadFailed = errors.New("could not read the file from Google Drive")
)

// DriveWindowUnavailableError es ErrDriveWindowUnavailable con el motivo.
type DriveWindowUnavailableError struct {
	Reason string
	Err    error
}

func (e *DriveWindowUnavailableError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", ErrDriveWindowUnavailable, e.Reason, e.Err)
	}
	return fmt.Sprintf("%s: %s", ErrDriveWindowUnavailable, e.Reason)
}
func (e *DriveWindowUnavailableError) Is(target error) bool {
	return target == ErrDriveWindowUnavailable
}
func (e *DriveWindowUnavailableError) Unwrap() error { return e.Err }

func unavailable(reason string, err error) error {
	return &DriveWindowUnavailableError{Reason: reason, Err: err}
}

// WindowUnavailableReason devuelve el motivo definitivo de un error ("" si no es de ese tipo).
func WindowUnavailableReason(err error) string {
	var ue *DriveWindowUnavailableError
	if errors.As(err, &ue) {
		return ue.Reason
	}
	return ""
}

// DriveReadError es ErrDriveWindowReadFailed con la causa clasificada.
type DriveReadError struct {
	Kind   string // drive.ErrKind* o ReadKind*
	Status int    // HTTP de Drive, si lo hubo
	Err    error
}

func (e *DriveReadError) Error() string {
	if e.Status != 0 {
		return fmt.Sprintf("%s (%s, HTTP %d): %v", ErrDriveWindowReadFailed, e.Kind, e.Status, e.Err)
	}
	return fmt.Sprintf("%s (%s): %v", ErrDriveWindowReadFailed, e.Kind, e.Err)
}
func (e *DriveReadError) Is(target error) bool { return target == ErrDriveWindowReadFailed }
func (e *DriveReadError) Unwrap() error        { return e.Err }

func kindRetryable(kind string) bool {
	switch kind {
	case "quota", "rate", "server", "network", "other":
		return true
	}
	return false
}

// driveClassified lo implementan los errores del paquete drive (sin importarlo desde acá).
type driveClassified interface {
	DriveErrorKind() string
	DriveStatus() int
}

// classifyReadError dice qué tipo de falla es err y, si vino de Drive, con qué código HTTP.
func classifyReadError(err error) (kind string, status int) {
	if err == nil {
		return "", 0
	}
	var dc driveClassified
	if errors.As(err, &dc) {
		return dc.DriveErrorKind(), dc.DriveStatus()
	}
	if errors.Is(err, context.Canceled) {
		return ReadKindCanceled, 0
	}
	if errors.Is(err, mkvsubs.ErrNotCluster) || errors.Is(err, mkvsubs.ErrMalformed) {
		return ReadKindFormat, 0
	}
	var ne net.Error
	if errors.As(err, &ne) || errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, io.EOF) {
		return "network", 0
	}
	return "other", 0
}

func newReadError(err error) *DriveReadError {
	kind, status := classifyReadError(err)
	return &DriveReadError{Kind: kind, Status: status, Err: err}
}

// healKind: ¿la falla indica que lo que la sesión sabe del archivo (Cues, tamaño) ya no
// vale? Entonces conviene descartar la sesión y volver a abrir el archivo.
func healKind(kind string) bool { return kind == ReadKindFormat || kind == "changed" }

// ReadFailureMessage es el texto corto (en español) para mostrar al usuario.
func ReadFailureMessage(kind string, status int) string {
	switch kind {
	case "quota":
		return "Google Drive limitó las descargas de este archivo (cuota diaria)"
	case "rate":
		return "Google Drive limitó el ritmo de lecturas (límite de uso)"
	case "auth":
		if status == 401 {
			return "Google Drive pide volver a autorizar la cuenta"
		}
		return "Google Drive no permitió leer el archivo"
	case "notfound":
		return "el archivo ya no está en Google Drive"
	case "server":
		return "Google Drive tuvo un error interno"
	case "network":
		return "no hay conexión estable con Google Drive"
	case "changed", ReadKindFormat:
		return "el archivo cambió en Google Drive"
	}
	return "no se pudo leer desde Google Drive"
}
