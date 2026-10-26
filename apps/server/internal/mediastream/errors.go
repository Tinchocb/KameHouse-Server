package mediastream

import "errors"

// ErrTranscodeDisabled: el archivo necesita transcodificación y TranscodeEnabled está apagado.
// El handler lo responde como 409 para que el cliente pueda explicarlo sin adivinar por texto.
var ErrTranscodeDisabled = errors.New("La transcodificación está desactivada. Actívala en Ajustes -> Streaming.")

// ErrDirectOnly: Solo original está activo, así que no se convierte el archivo. El handler lo
// responde como 409; el cliente no debe sugerir activar la transcodificación.
var ErrDirectOnly = errors.New("Solo original está activo: este archivo no se puede reproducir directo y no se convierte.")

// ErrTranscoderUnavailable: el transcoder no pudo arrancar (FFmpeg, directorio temporal, etc.).
// Se responde como 500 y no 503: el cliente reintenta los 503, y un FFmpeg ausente no se arregla esperando.
// Antes la reproducción directa devolvía igual un HLS sin transcoder detrás.
var ErrTranscoderUnavailable = errors.New("el transcoder no pudo iniciarse; revisá FFmpeg y el directorio temporal en Ajustes -> Streaming")
