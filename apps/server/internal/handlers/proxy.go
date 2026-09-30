package handlers

import (
	"bytes"
	"io"
	"kamehouse/internal/util"
	"net/http"
	url2 "net/url"
	"strconv"
	"strings"
	"time"

	"github.com/5rahim/hls-m3u8/m3u8"
	"github.com/goccy/go-json"
	"github.com/imroc/req/v3"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

// proxyPassthroughHeaders son las únicas cabeceras del upstream que VideoProxy
// reenvía al cliente.
var proxyPassthroughHeaders = []string{
	"Content-Type",
	"Content-Range",
	"Accept-Ranges",
	"ETag",
	"Last-Modified",
	"Cache-Control",
}

var videoProxyClient2 = req.C().
	SetTimeout(60 * time.Second).
	// El dialer rechaza IPs internas en cada conexión (redirects, DNS rebinding).
	SetDial(util.ProxySafeDialContext).
	ImpersonateChrome()

func (h *Handler) VideoProxy(c echo.Context) (err error) {
	defer util.HandlePanicInModuleWithError("util/VideoProxy", &err)

	url := c.QueryParam("url")
	if !util.IsValidProxyURL(url) {
		return echo.NewHTTPError(http.StatusForbidden, "SSRF blocked: invalid proxy URL")
	}
	headers := c.QueryParam("headers")

	r := videoProxyClient2.R()

	var headerMap map[string]string
	if headers != "" {
		if err := json.Unmarshal([]byte(headers), &headerMap); err != nil {
			h.App.Logger.Error().Err(err).Msg("proxy: Error unmarshalling headers")
			return echo.NewHTTPError(http.StatusInternalServerError)
		}
		// Solo cabeceras de la allowlist; el mapa filtrado es también el que se
		// propaga a las URLs reescritas del playlist.
		headerMap = util.FilterProxyRequestHeaders(headerMap)
		for key, value := range headerMap {
			r.SetHeader(key, value)
		}
	}

	r.SetHeader("Accept", "*/*")
	if rangeHeader := c.Request().Header.Get("Range"); rangeHeader != "" {
		r.SetHeader("Range", rangeHeader)
	}

	// Always use GET request internally, even for HEAD requests
	resp, err := r.Get(url)

	if err != nil {
		h.App.Logger.Error().Err(err).Msg("proxy: Error sending request")
		return echo.NewHTTPError(http.StatusInternalServerError)
	}
	defer resp.Body.Close()

	// Solo cabeceras de contenido: copiar todas dejaba que un upstream
	// arbitrario inyectara Set-Cookie, CORS o Location bajo nuestro origen.
	// Content-Length se omite (net::ERR_CONTENT_LENGTH_MISMATCH).
	for _, k := range proxyPassthroughHeaders {
		if v := resp.Header.Get(k); v != "" {
			c.Response().Header().Set(k, v)
		}
	}
	// El Content-Type no se reenvía tal cual: un upstream que declare text/html o
	// image/svg+xml ejecutaría su contenido bajo nuestro origen. Solo pasan tipos
	// de medios; el resto se sirve como application/octet-stream.
	c.Response().Header().Set(echo.HeaderContentType, util.SafeProxyContentType(resp.Header.Get("Content-Type")))
	util.HardenProxyResponse(c.Response().Header())

	// Vary: Origin for correct caching with credentials (handled by global middleware).
	c.Response().Header().Set("Vary", "Origin")

	// For HEAD requests, return only headers (with the upstream status: a 404
	// upstream must not look like an available resource).
	if c.Request().Method == http.MethodHead {
		return c.NoContent(resp.StatusCode)
	}

	isHlsPlaylist := strings.HasSuffix(url, ".m3u8") || strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "mpegurl")

	if !isHlsPlaylist {
		return c.Stream(resp.StatusCode, c.Response().Header().Get("Content-Type"), resp.Body)
	}

	// HLS Playlist
	const maxPlaylistSize = 5 * 1024 * 1024 // 5 MB limit
	lr := io.LimitReader(resp.Body, maxPlaylistSize+1)
	bodyBytes, readErr := io.ReadAll(lr)
	if readErr != nil {
		h.App.Logger.Error().Err(readErr).Str("url", url).Msg("proxy: Error reading HLS response body")
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to read HLS playlist")
	}
	if len(bodyBytes) > maxPlaylistSize {
		h.App.Logger.Error().Str("url", url).Msg("proxy: HLS playlist exceeds maximum allowed size (DoS protect)")
		return echo.NewHTTPError(http.StatusRequestEntityTooLarge, "HLS playlist too large")
	}

	buffer := bytes.NewBuffer(bodyBytes)
	playlist, listType, decodeErr := m3u8.Decode(*buffer, true)
	if decodeErr != nil {
		// Playlist might be valid but not decodable by the library, or simply corrupted.
		// Option 1: Proxy as-is (might be preferred if decoding fails unexpectedly)
		h.App.Logger.Warn().Err(decodeErr).Str("url", url).Msg("proxy: Failed to decode M3U8 playlist, proxying raw content")
		c.Response().Header().Set(echo.HeaderContentType, util.SafeProxyContentType(resp.Header.Get("Content-Type")))
		c.Response().Header().Set(echo.HeaderContentLength, strconv.Itoa(len(bodyBytes)))
		c.Response().WriteHeader(resp.StatusCode)
		_, writeErr := c.Response().Writer.Write(bodyBytes)
		return writeErr
	}

	var modifiedPlaylistBytes []byte
	needsRewrite := false         // Flag to check if we actually need to rewrite
	baseURL, _ := url2.Parse(url) // Base URL for resolving relative paths

	switch listType {
	case m3u8.MEDIA:
		mediaPl := playlist.(*m3u8.MediaPlaylist)

		for _, segment := range mediaPl.Segments {
			if segment != nil {
				// Rewrite Segment URI
				if rewriteURI(&segment.URI, baseURL, headerMap, h.App.Logger) {
					needsRewrite = true
				}

				// Rewrite encryption key URIs
				for i := range segment.Keys {
					if rewriteURI(&segment.Keys[i].URI, baseURL, headerMap, h.App.Logger) {
						needsRewrite = true
					}
				}

				if segment.Map != nil {
					if rewriteURI(&segment.Map.URI, baseURL, headerMap, h.App.Logger) {
						needsRewrite = true
					}
				}
			}
		}

		for _, segment := range mediaPl.PartialSegments {
			if segment != nil {
				// Rewrite Segment URI
				if rewriteURI(&segment.URI, baseURL, headerMap, h.App.Logger) {
					needsRewrite = true
				}
			}
		}

		if mediaPl.PreloadHints != nil {
			if rewriteURI(&mediaPl.PreloadHints.URI, baseURL, headerMap, h.App.Logger) {
				needsRewrite = true
			}
		}

		if mediaPl.Map != nil {
			if rewriteURI(&mediaPl.Map.URI, baseURL, headerMap, h.App.Logger) {
				needsRewrite = true
			}
		}

		// Rewrite playlist-level encryption key URIs
		for i := range mediaPl.Keys {
			if rewriteURI(&mediaPl.Keys[i].URI, baseURL, headerMap, h.App.Logger) {
				needsRewrite = true
			}
		}

		// Encode the modified media playlist
		buffer := mediaPl.Encode()
		modifiedPlaylistBytes = buffer.Bytes()

	case m3u8.MASTER:
		// Rewrite URIs in Master playlists
		masterPl := playlist.(*m3u8.MasterPlaylist)

		for _, variant := range masterPl.Variants {
			if variant != nil {
				if rewriteURI(&variant.URI, baseURL, headerMap, h.App.Logger) {
					needsRewrite = true
				}

				// Handle alternative media groups (audio, subtitles, etc.)
				for _, alternative := range variant.Alternatives {
					if alternative != nil && rewriteURI(&alternative.URI, baseURL, headerMap, h.App.Logger) {
						needsRewrite = true
					}
				}
			}
		}

		// Rewrite session key URIs
		for i := range masterPl.SessionKeys {
			if rewriteURI(&masterPl.SessionKeys[i].URI, baseURL, headerMap, h.App.Logger) {
				needsRewrite = true
			}
		}

		// Encode the modified master playlist
		buffer := masterPl.Encode()
		modifiedPlaylistBytes = buffer.Bytes()

	default:
		// Unknown type, pass through
		modifiedPlaylistBytes = bodyBytes
	}

	// Update headers
	contentType := "application/vnd.apple.mpegurl"
	c.Response().Header().Set(echo.HeaderContentType, contentType)
	c.Response().Header().Set(echo.HeaderContentLength, strconv.Itoa(len(modifiedPlaylistBytes)))
	if resp.Header.Get("Cache-Control") == "" {
		c.Response().Header().Set("Cache-Control", "no-cache")
	}
	h.App.Logger.Debug().Bool("rewritten", needsRewrite).Str("url", url).Msg("proxy: Sending modified HLS playlist")

	// Un solo WriteHeader: antes se escribía el status del upstream y luego
	// c.Blob(200) intentaba otro ("response already committed").
	return c.Blob(resp.StatusCode, contentType, modifiedPlaylistBytes)
}

// rewriteURI rewrites a URI pointer if needed, returns true if modified
func rewriteURI(uri *string, baseURL *url2.URL, headerMap map[string]string, logger *zerolog.Logger) bool {
	if *uri == "" || isAlreadyProxied(*uri) {
		return false
	}

	// Resolve relative URLs
	if !strings.HasPrefix(*uri, "http") {
		*uri = resolveURL(baseURL, *uri)
	}

	*uri = toProxyURL(*uri, headerMap, logger)
	return true
}

func resolveURL(base *url2.URL, relativeURI string) string {
	if base == nil {
		return relativeURI // Cannot resolve without a base
	}
	relativeURL, err := url2.Parse(relativeURI)
	if err != nil {
		return relativeURI // Invalid relative URI
	}
	return base.ResolveReference(relativeURL).String()
}

func toProxyURL(targetMediaURL string, headerMap map[string]string, logger *zerolog.Logger) string {
	proxyURL := "/api/v1/proxy?url=" + url2.QueryEscape(targetMediaURL)
	if len(headerMap) > 0 {
		headersStrB, err := json.Marshal(headerMap)
		if err != nil {
			logger.Warn().Err(err).Msg("proxy: failed to marshal headers")
		} else if len(headersStrB) > 2 {
			proxyURL += "&headers=" + url2.QueryEscape(string(headersStrB))
		}
	}
	return proxyURL
}

func isAlreadyProxied(url string) bool {
	// Check if the URL contains the proxy pattern
	return strings.Contains(url, "/api/v1/proxy?url=") || strings.Contains(url, url2.QueryEscape("/api/v1/proxy?url="))
}
