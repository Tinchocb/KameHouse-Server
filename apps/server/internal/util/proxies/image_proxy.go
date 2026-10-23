package util

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/imroc/req/v3"
	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

// Disk eviction is size-based on ModTime: touching hits keeps popular images, but at most
// once a day so a busy grid doesn't turn every read into a metadata write.
const imageProxyTouchMinAge = 24 * time.Hour

var (
	// Shared so upstream connections (TLS, keep-alive) are reused across images.
	// El dialer rechaza IPs internas en cada conexión (redirects, DNS rebinding).
	// DisableAutoReadResponse: por defecto req lee el cuerpo entero en memoria antes de
	// devolver la respuesta, y el tope de 25 MB de fetchImage no protegería nada.
	imageProxyClient = req.C().SetTimeout(30 * time.Second).SetDial(util.ProxySafeDialContext).DisableAutoReadResponse()
	// Collapses concurrent cold fetches of the same URL into one download.
	imageProxyFlights singleflight.Group
)

type ImageProxy struct {
	CacheDir  string
	mkdirOnce sync.Once
}

type proxiedImage struct {
	body        []byte
	contentType string
}

// readCached returns the cached bytes for cachePath, touching the file so eviction keeps it.
func readCached(cachePath string) ([]byte, bool) {
	data, err := os.ReadFile(cachePath)
	if err != nil || len(data) == 0 {
		return nil, false
	}
	if info, statErr := os.Stat(cachePath); statErr == nil {
		cache.TouchDiskCacheIfOlder(cachePath, info, imageProxyTouchMinAge)
	}
	return data, true
}

// readCachedImage lee la caché y devuelve el tipo real según los bytes. Un
// archivo que no es una imagen (caché escrita por una versión anterior que no
// validaba, o corrupta) se borra y cuenta como fallo de caché.
func readCachedImage(cachePath string) ([]byte, string, bool) {
	data, ok := readCached(cachePath)
	if !ok {
		return nil, "", false
	}
	contentType := util.SafeImageContentType("", data)
	if contentType == "" {
		contentType = util.SafeImageContentType("image/avif", data) // Go no detecta AVIF por sus bytes
	}
	if contentType == "" {
		_ = os.Remove(cachePath)
		return nil, "", false
	}
	return data, contentType, true
}

// validateCachedImage inspecciona solo la cabecera (primeros 512 bytes) del archivo
// en disco para determinar el tipo de imagen ráster segura y tocar el LRU sin
// cargar todo el archivo en el heap. Si el archivo está corrupto o no es imagen,
// se borra y se devuelve false.
func validateCachedImage(cachePath string) (string, bool) {
	f, err := os.Open(cachePath)
	if err != nil {
		return "", false
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil || info.Size() == 0 {
		return "", false
	}

	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return "", false
	}
	header := buf[:n]

	contentType := util.SafeImageContentType("", header)
	if contentType == "" {
		contentType = util.SafeImageContentType("image/avif", header)
	}
	if contentType == "" {
		_ = f.Close()
		_ = os.Remove(cachePath)
		return "", false
	}

	cache.TouchDiskCacheIfOlder(cachePath, info, imageProxyTouchMinAge)
	return contentType, true
}

func (ip *ImageProxy) ensureDir() string {
	dir := ip.CacheDir
	if dir == "" {
		dir = filepath.Join(os.TempDir(), "kamehouse_image_cache")
	}
	ip.mkdirOnce.Do(func() {
		_ = os.MkdirAll(dir, 0755)
	})
	return dir
}

func (ip *ImageProxy) getCachePath(url string) string {
	dir := ip.ensureDir()
	hash := sha256.Sum256([]byte(url))
	return filepath.Join(dir, hex.EncodeToString(hash[:])+".cache")
}

func (ip *ImageProxy) GetImage(url string, headers map[string]string) ([]byte, string, error) {
	cachePath := ip.getCachePath(url)
	if data, contentType, ok := readCachedImage(cachePath); ok {
		return data, contentType, nil
	}

	v, err, _ := imageProxyFlights.Do(cachePath, func() (interface{}, error) {
		body, contentType, err := ip.fetchImage(url, cachePath, headers)
		if err != nil {
			return nil, err
		}
		return proxiedImage{body: body, contentType: contentType}, nil
	})
	if err != nil {
		return nil, "", err
	}
	img := v.(proxiedImage)
	return img.body, img.contentType, nil
}

func (ip *ImageProxy) fetchImage(url string, cachePath string, headers map[string]string) ([]byte, string, error) {
	request := imageProxyClient.NewRequest()

	for key, value := range headers {
		request.SetHeader(key, value)
	}

	resp, err := request.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	// Solo se cachea una imagen real: antes un 404/5xx del origen (página de
	// error) quedaba guardado en disco como si fuera la imagen, para siempre.
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, "", fmt.Errorf("image proxy: upstream returned %d for %s", resp.StatusCode, url)
	}

	const maxImageSize = 25 * 1024 * 1024 // 25 MB limit
	lr := io.LimitReader(resp.Body, maxImageSize+1)
	body, err := io.ReadAll(lr)
	if err != nil {
		return nil, "", err
	}
	if len(body) > maxImageSize {
		return nil, "", fmt.Errorf("ssrf proxy: image exceeds maximum allowed size of 25MB")
	}

	// Solo se sirve (y se cachea) una imagen ráster, decidida por los bytes y no
	// por el Content-Type del origen: un HTML o un SVG con script servido bajo
	// nuestro origen ejecutaría código con los privilegios de la app.
	contentType := util.SafeImageContentType(resp.Header.Get("Content-Type"), body)
	if contentType == "" {
		return nil, "", fmt.Errorf("image proxy: %s no es una imagen ráster admitida", url)
	}

	// Persist to disk cache atomically (tmp+rename) to avoid corrupt .cache on crash.
	// Unique tmp suffix: concurrent fetches of the same uncached URL must not share the tmp file.
	tmpPath := fmt.Sprintf("%s.tmp.%d", cachePath, time.Now().UnixNano())
	if err := os.WriteFile(tmpPath, body, 0644); err != nil {
		return nil, "", err
	}
	if err := os.Rename(tmpPath, cachePath); err != nil {
		_ = os.Remove(tmpPath)
		return nil, "", err
	}

	return body, contentType, nil
}

func (ip *ImageProxy) setHeaders(c echo.Context, contentType string) {
	if contentType == "" {
		contentType = "image/jpeg"
	}
	c.Response().Header().Set("Content-Type", contentType)
	util.HardenProxyResponse(c.Response().Header())
	c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("Access-Control-Allow-Methods", "GET")
	c.Response().Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
}

func (ip *ImageProxy) ProxyImage(c echo.Context) (err error) {
	defer util.HandlePanicInModuleWithError("util/ImageProxy", &err)

	url := c.QueryParam("url")
	if url == "" {
		return c.String(echo.ErrBadRequest.Code, "No URL provided")
	}

	// Fast path: check local disk cache first. If already downloaded, serve immediately
	// without any network or DNS lookup overhead and with zero heap copy.
	cachePath := ip.getCachePath(url)
	if contentType, ok := validateCachedImage(cachePath); ok {
		ip.setHeaders(c, contentType)
		return c.File(cachePath)
	}

	if !util.IsValidProxyURL(url) {
		return c.String(echo.ErrForbidden.Code, "SSRF blocked: invalid proxy URL")
	}

	headers := make(map[string]string)
	headersJSON := c.QueryParam("headers")
	if headersJSON != "" {
		_ = json.Unmarshal([]byte(headersJSON), &headers)
		headers = util.FilterProxyRequestHeaders(headers)
	}

	// GetImage persiste la imagen en cachePath antes de volver: se sirve desde disco
	// (c.File, sin retener el buffer de hasta 25 MB en el heap durante la transferencia).
	_, contentType, err := ip.GetImage(url, headers)
	if err != nil {
		return c.String(echo.ErrInternalServerError.Code, "Error fetching image")
	}

	ip.setHeaders(c, contentType)
	return c.File(ip.getCachePath(url))
}

// prewarmURLValid es la validación SSRF de Prewarm (reemplazable en tests,
// donde el origen falso vive en 127.0.0.1).
var prewarmURLValid = util.IsValidProxyURL

// Prewarm baja al disco las URLs que todavía no están cacheadas, con
// concurrencia limitada. No devuelve error: las que fallan se piden de nuevo
// cuando la interfaz las necesite. Devuelve cuántas se descargaron.
func (ip *ImageProxy) Prewarm(urls []string, concurrency int) int {
	if concurrency <= 0 {
		concurrency = 3
	}
	sem := make(chan struct{}, concurrency)
	var mu sync.Mutex
	var wg sync.WaitGroup
	fetched := 0
	seen := make(map[string]struct{}, len(urls))
	for _, u := range urls {
		if u == "" || !prewarmURLValid(u) {
			continue
		}
		if _, dup := seen[u]; dup {
			continue
		}
		seen[u] = struct{}{}
		if info, err := os.Stat(ip.getCachePath(u)); err == nil && info.Size() > 0 {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(u string) {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() { _ = recover() }()
			if _, _, err := ip.GetImage(u, nil); err == nil {
				mu.Lock()
				fetched++
				mu.Unlock()
			}
		}(u)
	}
	wg.Wait()
	return fetched
}
