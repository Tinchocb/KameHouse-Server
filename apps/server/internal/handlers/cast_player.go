package handlers

import (
	"fmt"
	"html"
	"net/http"
	"net/url"
	"strings"

	"github.com/labstack/echo/v4"
)

// HandleCastPlayer serves a minimal HTML5 video player page for Smart TVs.
// The TV browser opens this page to play the stream directly.
func (h *Handler) HandleCastPlayer(c echo.Context) error {
	streamURL := c.QueryParam("url")
	title := c.QueryParam("title")
	if title == "" {
		title = "KameHouse"
	}
	if streamURL == "" {
		return c.String(http.StatusBadRequest, "Missing 'url' parameter")
	}

	videoTag, playerScript := buildPlayerHTML(streamURL)

	page := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; background:#000; }
body { width:100vw; height:100vh; overflow:hidden; }
video { width:100%%; height:100%%; object-fit:contain; }
</style>
</head>
<body>
%s
%s
</body>
</html>`, html.EscapeString(title), videoTag, playerScript)

	c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
	c.Response().Header().Set("Cache-Control", "no-cache")
	return c.String(http.StatusOK, page)
}

// HandleCastGo redirects to the last cast URL for easy manual TV entry.
// Users can bookmark this URL on their TV browser for instant playback.
func (h *Handler) HandleCastGo(c echo.Context) error {
	lastCastURLMu.RLock()
	urlStr := lastCastURL
	lastCastURLMu.RUnlock()

	if urlStr == "" {
		return c.String(http.StatusOK, castIdlePage)
	}

	// If the URL is a raw video/stream URL, wrap it in the cast player URL
	if !strings.Contains(urlStr, "/cast/player") && (strings.Contains(urlStr, "/mediastream") || strings.HasSuffix(urlStr, ".m3u8") || strings.HasSuffix(urlStr, ".mp4") || strings.Contains(urlStr, "/proxy")) {
		urlStr = fmt.Sprintf("/api/v1/cast/player?url=%s&title=KameHouse", url.QueryEscape(urlStr))
	}

	// Dynamically replace localhost/127.0.0.1 or mismatching host with the Host requested by the TV
	reqHost := c.Request().Host
	u, err := url.Parse(urlStr)
	if err == nil {
		u.Host = reqHost
		// Determine scheme (http/https) matching the TV request
		if proto := c.Request().Header.Get("X-Forwarded-Proto"); proto != "" {
			u.Scheme = proto
		} else {
			u.Scheme = c.Scheme()
		}

		// Also update the nested stream URL parameter if present
		q := u.Query()
		streamURLStr := q.Get("url")
		if streamURLStr != "" {
			su, err := url.Parse(streamURLStr)
			if err == nil {
				su.Host = reqHost
				if proto := c.Request().Header.Get("X-Forwarded-Proto"); proto != "" {
					su.Scheme = proto
				} else {
					su.Scheme = c.Scheme()
				}
				q.Set("url", su.String())
			}
		}
		u.RawQuery = q.Encode()
		urlStr = u.String()
	}

	return c.Redirect(http.StatusTemporaryRedirect, urlStr)
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

// buildPlayerHTML returns the <video> tag and player script for the given stream URL.
// HLS streams use HLS.js; direct files use native <video>.
func buildPlayerHTML(streamURL string) (videoTag, playerScript string) {
	isHLS := strings.HasSuffix(streamURL, ".m3u8") || strings.Contains(streamURL, "/hls/")

	if isHLS {
		videoTag = `<video id="v" autoplay controls playsinline></video>`
		playerScript = fmt.Sprintf(`
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
var video = document.getElementById('v');
var streamURL = %q;
if (Hls.isSupported()) {
  var hls = new Hls({
    maxMaxBufferLength: 10,
    enableWorker: true,
    lowLatencyMode: false
  });
  hls.loadSource(streamURL);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play(); });
} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = streamURL;
  video.play();
}
</script>`, streamURL)
	} else {
		videoTag = fmt.Sprintf(`<video id="v" src="%s" autoplay controls playsinline></video>`, html.EscapeString(streamURL))
		playerScript = `<script>document.getElementById('v').play();</script>`
	}

	return videoTag, playerScript
}

// castIdlePage is the HTML shown when no cast session is active.
var castIdlePage = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>KameHouse Cast</title>
<style>
body { background:#0a0a0c; color:#fff; font-family:sans-serif; text-align:center; padding-top:20vh; margin:0; }
.card { background:#16161a; border:1px solid #27272a; display:inline-block; padding:2rem; border-radius:1.5rem; max-width:400px; box-shadow:0 20px 40px rgba(0,0,0,0.5); }
h1 { color:#ff6e3a; font-size:1.5rem; margin-top:0; letter-spacing:0.05em; }
p { color:#a1a1aa; font-size:0.9rem; line-height:1.5; }
</style>
</head>
<body>
<div class="card">
<h1>KameHouse Cast</h1>
<p>No hay ninguna transmisión activa en este momento.</p>
<p>Inicia la reproducción de un video en tu computadora o teléfono y haz clic en el botón de Transmitir.</p>
</div>
</body>
</html>`
