package mediastream

import (
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/samber/mo"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/videofile"
)

func TestNativeStaticHLSTreeCarriesPlaybackCredentials(t *testing.T) {
	dir := t.TempDir()
	root := filepath.Join(dir, "hash")
	require.NoError(t, os.MkdirAll(filepath.Join(root, "audio"), 0700))
	for name, body := range map[string]string{
		"master.m3u8":      "#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI=\"audio/index.m3u8\"\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex.m3u8\n",
		"index.m3u8":       "#EXTM3U\n#EXTINF:4,\nsegment.ts\n",
		"audio/index.m3u8": "#EXTM3U\n#EXTINF:4,\nsegment.ts\n",
		"segment.ts":       "video fixture", "audio/segment.ts": "audio fixture",
	} {
		require.NoError(t, os.WriteFile(filepath.Join(root, name), []byte(body), 0600))
	}
	l := zerolog.Nop()
	r := &Repository{logger: &l, settings: mo.Some(&models.MediastreamSettings{PreTranscodeLibraryDir: dir})}
	r.playbackManager = NewPlaybackManager(r)
	r.playbackManager.clientMediaContainers.Set("native-tv", &MediaContainer{Hash: "hash"})
	e := echo.New()
	e.GET("/api/v1/mediastream/hls/*", func(c echo.Context) error { return r.ServeEchoOptimizedStream(c, c.QueryParam("clientId")) })
	visited := 0
	var follow func(*url.URL)
	follow = func(u *url.URL) {
		require.Equal(t, "resource-token", u.Query().Get("token"))
		require.Equal(t, "native-tv", u.Query().Get("clientId"))
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest("GET", u.String(), nil))
		require.Equal(t, 200, rec.Code)
		visited++
		if !strings.HasSuffix(u.Path, ".m3u8") {
			return
		}
		for _, line := range strings.Split(rec.Body.String(), "\n") {
			if strings.Contains(line, `URI="`) {
				m := uriAttrRe.FindStringSubmatch(line)
				child, err := url.Parse(m[1])
				require.NoError(t, err)
				follow(u.ResolveReference(child))
			} else if line != "" && !strings.HasPrefix(line, "#") {
				child, err := url.Parse(line)
				require.NoError(t, err)
				follow(u.ResolveReference(child))
			}
		}
	}
	u, err := url.Parse("http://example.test/api/v1/mediastream/hls/master.m3u8?clientId=native-tv&token=resource-token")
	require.NoError(t, err)
	follow(u)
	require.Equal(t, 5, visited)
}

func TestHLSCredentialsDoNotEscapeToExternalURLs(t *testing.T) {
	input := "#EXTM3U\r\n#EXT-X-MEDIA:URI=\"https://cdn.example/audio.m3u8\"\r\n//cdn.example/file.ts\r\n./index.m3u8?v=x\r\n"
	got := withPlaybackCredentials(input, "", "secret")
	require.Contains(t, got, `URI="https://cdn.example/audio.m3u8"`)
	require.Contains(t, got, "//cdn.example/file.ts\r\n")
	require.Contains(t, got, "./index.m3u8?token=secret&v=x\r\n")
	require.Equal(t, got, withPlaybackCredentials(got, "", "secret"))
}

func TestLiveHLSMasterVideoAndAudioPropagateToken(t *testing.T) {
	dir := t.TempDir()
	l := zerolog.Nop()
	tc, err := cassette.New(&cassette.NewCassetteOptions{Logger: &l, TempOutDir: dir, HwAccelKind: "disabled"})
	require.NoError(t, err)
	t.Cleanup(tc.Destroy)
	// A completed synthetic index keeps this a contract test: no video probe,
	// download or encoder is launched by a playlist request.
	const hash = "hls-auth-contract"
	require.NoError(t, os.WriteFile(filepath.Join(dir, "keyframes", hash+".json"), []byte(`{"sha":"hls-auth-contract","keyframes":[0,4,8],"isDone":true}`), 0600))
	r := &Repository{logger: &l, settings: mo.Some(&models.MediastreamSettings{}), transcoder: mo.Some(tc)}
	r.playbackManager = NewPlaybackManager(r)
	lang := "es"
	r.playbackManager.clientMediaContainers.Set("tv", &MediaContainer{Hash: hash, Filepath: filepath.Join(dir, "synthetic.mp4"), MediaInfo: &videofile.MediaInfo{Duration: 10, Video: &videofile.Video{Codec: "h264", Width: 640, Height: 360}, Audios: []videofile.Audio{{Index: 1, Channels: 2, Language: &lang}}}})
	e := echo.New()
	e.GET("/api/v1/mediastream/transcode/*", func(c echo.Context) error { return r.ServeEchoTranscodeStream(c, c.QueryParam("clientId")) })
	for _, path := range []string{"master.m3u8", "source/index.m3u8", "audio/1/index.m3u8"} {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/mediastream/transcode/"+path+"?clientId=tv&token=resource-token", nil))
		require.Equal(t, 200, rec.Code, rec.Body.String())
		uriCount := 0
		for _, line := range strings.Split(rec.Body.String(), "\n") {
			var raw string
			if strings.Contains(line, `URI="`) {
				raw = uriAttrRe.FindStringSubmatch(line)[1]
			} else if line != "" && !strings.HasPrefix(line, "#") {
				raw = line
			}
			if raw == "" {
				continue
			}
			u, err := url.Parse(raw)
			require.NoError(t, err)
			require.Equal(t, "resource-token", u.Query().Get("token"), "%s lost access token in %s", path, raw)
			require.Equal(t, "tv", u.Query().Get("clientId"))
			uriCount++
		}
		require.Positive(t, uriCount)
	}
}
