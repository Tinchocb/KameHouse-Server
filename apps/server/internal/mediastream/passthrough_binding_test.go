package mediastream

import (
	"kamehouse/internal/mediastream/videofile"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

// Regresión: el master y los segmentos HLS llegan sin client id y resuelven el contenedor
// "actual". Si el passthrough quedaba sólo en el mapa por cliente, ese fallback servía la
// escalera re-codificada (240p-1080p en NVENC) y el stream se caía al bajar de tier.
func TestApplyVideoPassthroughBindsCurrentMedia(t *testing.T) {
	nop := zerolog.Nop()
	r := &Repository{logger: &nop}
	r.playbackManager = NewPlaybackManager(r)

	yes := true
	info := &videofile.MediaInfo{Video: &videofile.Video{Codec: "hevc", PixFmt: "yuv420p"}}
	ret := &MediaContainer{Filepath: "/x.mkv", Hash: "h", StreamType: StreamTypeTranscode, MediaInfo: info}
	r.playbackManager.setCurrentMediaContainer(ret)

	out := r.applyVideoPassthrough(ret, &ClientCapabilities{Hevc: true, HlsHevc: &yes}, "player-abc")
	require.True(t, out.VideoPassthrough)
	require.False(t, ret.VideoPassthrough, "el contenedor compartido no debe mutarse")

	cur, ok := r.playbackManager.getCurrentMediaContainer()
	require.True(t, ok)
	require.True(t, cur.VideoPassthrough, "el fallback sin client id debe servir la copia de video")

	bound, ok := r.playbackManager.clientMediaContainers.Get("player-abc")
	require.True(t, ok)
	require.True(t, bound.VideoPassthrough)
}
