package util

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"kamehouse/internal/util"
	"kamehouse/internal/util/cache"
	"net/http"
	"os"
	"path/filepath"
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
	imageProxyClient = req.C().SetTimeout(30 * time.Second)
	// Collapses concurrent cold fetches of the same URL into one download.
	imageProxyFlights singleflight.Group
)

type ImageProxy struct {
	CacheDir string
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

func (ip *ImageProxy) getCachePath(url string) string {
	dir := ip.CacheDir
	if dir == "" {
		dir = filepath.Join(os.TempDir(), "kamehouse_image_cache")
	}
	_ = os.MkdirAll(dir, 0755)
	hash := sha256.Sum256([]byte(url))
	return filepath.Join(dir, hex.EncodeToString(hash[:])+".cache")
}

func (ip *ImageProxy) GetImage(url string, headers map[string]string) ([]byte, string, error) {
	cachePath := ip.getCachePath(url)
	if data, ok := readCached(cachePath); ok {
		return data, http.DetectContentType(data), nil
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

	const maxImageSize = 25 * 1024 * 1024 // 25 MB limit
	lr := io.LimitReader(resp.Body, maxImageSize+1)
	body, err := io.ReadAll(lr)
	if err != nil {
		return nil, "", err
	}
	if len(body) > maxImageSize {
		return nil, "", fmt.Errorf("ssrf proxy: image exceeds maximum allowed size of 25MB")
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

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(body)
	}

	return body, contentType, nil
}

func (ip *ImageProxy) setHeaders(c echo.Context, contentType string) {
	if contentType == "" {
		contentType = "image/jpeg"
	}
	c.Response().Header().Set("Content-Type", contentType)
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
	// without any network or DNS lookup overhead.
	cachePath := ip.getCachePath(url)
	if data, ok := readCached(cachePath); ok {
		contentType := http.DetectContentType(data)
		ip.setHeaders(c, contentType)
		return c.Blob(http.StatusOK, contentType, data)
	}

	if !util.IsValidProxyURL(url) {
		return c.String(echo.ErrForbidden.Code, "SSRF blocked: invalid proxy URL")
	}

	headers := make(map[string]string)
	headersJSON := c.QueryParam("headers")
	if headersJSON != "" {
		_ = json.Unmarshal([]byte(headersJSON), &headers)
	}

	imageBuffer, contentType, err := ip.GetImage(url, headers)
	if err != nil {
		return c.String(echo.ErrInternalServerError.Code, "Error fetching image")
	}

	ip.setHeaders(c, contentType)
	return c.Blob(http.StatusOK, contentType, imageBuffer)
}
