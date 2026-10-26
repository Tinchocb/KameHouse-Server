package mediastream

import (
	"testing"

	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"github.com/stretchr/testify/require"
)

// newDirectOnlyRepo arma un Repository inicializado (con ajustes) y sin engine ni
// playbackManager: si un guard falla, el test cae en nil-deref en vez de pasar en silencio.
func newDirectOnlyRepo(directPlayOnly bool) *Repository {
	nop := zerolog.Nop()
	return &Repository{
		settings: mo.Some(&models.MediastreamSettings{DirectPlayOnly: directPlayOnly, TranscodeEnabled: true}),
		logger:   &nop,
	}
}

func TestDirectPlayOnlyHelperReadsSettings(t *testing.T) {
	require.True(t, newDirectOnlyRepo(true).DirectPlayOnly())
	require.False(t, newDirectOnlyRepo(false).DirectPlayOnly())
	// Fail-closed: sin ajustes cargados se asume Solo original.
	require.True(t, (&Repository{}).DirectPlayOnly(), "sin ajustes el modo debe ser fail-closed")
}

// Con "Solo original" un calentamiento o un preload de transcode no arrancan el encoder:
// retornan sin tocar el engine (que aquí no existe; tocarlo habría fallado).
func TestDirectPlayOnlyGuardsTranscodePreloads(t *testing.T) {
	r := newDirectOnlyRepo(true)
	require.NoError(t, r.WarmTranscodeSession("/no/existe.mkv"))
	require.NoError(t, r.RequestPreloadTranscodeStream("/no/existe.mkv", "jpn"))
	require.NoError(t, r.RequestPreloadOptimizedStream("/no/existe.mkv"))
	_, ok := r.getTranscoder()
	require.False(t, ok, "no debe haber engine con Solo original")
}

// El engine no se construye ni siquiera ante un pedido forzado (cambio de pista, fallback):
// ese era el hueco por el que un ajuste apagado seguía arrancando ffmpeg.
func TestDirectPlayOnlyRefusesEngineEvenWhenForced(t *testing.T) {
	r := newDirectOnlyRepo(true)
	require.False(t, r.initializeTranscoder(r.GetSettings(), true), "force no debe saltarse Solo original")
	require.False(t, r.initializeTranscoder(r.GetSettings(), false))
	_, ok := r.getTranscoder()
	require.False(t, ok)
}

func TestDirectPlayOnlyRefusesTranscodeAndOptimizedRequests(t *testing.T) {
	r := newDirectOnlyRepo(true)
	_, err := r.RequestTranscodeStream("/no/existe.mkv", "client", true, nil)
	require.ErrorIs(t, err, ErrDirectOnly)
	_, err = r.RequestOptimizedStream("/no/existe.mkv", "client")
	require.ErrorIs(t, err, ErrDirectOnly)
}

// El worker de pre-transcode no existe con Solo original, aunque PreTranscodeEnabled esté activo
// (en la base real hoy están ambos encendidos).
func TestDirectPlayOnlyKeepsPreTranscoderStopped(t *testing.T) {
	r := newDirectOnlyRepo(true)
	r.initializePreTranscoder(&models.MediastreamSettings{PreTranscodeEnabled: true, DirectPlayOnly: true})
	_, ok := r.PreTranscoder()
	require.False(t, ok, "con Solo original no debe haber worker de pre-transcode")
}
