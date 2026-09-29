package util

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"syscall"
	"time"
)

type proxyHostCacheEntry struct {
	valid     bool
	expiresAt time.Time
}

var proxyHostCache sync.Map

// IsValidProxyURL tests whether a URL is secure to proxy (blocks SSRF to localhost/private network)
func IsValidProxyURL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}

	host := u.Hostname()
	if host == "" {
		return false
	}

	// Check in-memory DNS cache first to avoid slow synchronous DNS lookups per image request
	if cached, ok := proxyHostCache.Load(host); ok {
		entry := cached.(proxyHostCacheEntry)
		if time.Now().Before(entry.expiresAt) {
			return entry.valid
		}
		proxyHostCache.Delete(host)
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		// If LookupIP fails, try ParseIP in case it's already an IP string
		ip := net.ParseIP(host)
		if ip == nil {
			return false
		}
		ips = []net.IP{ip}
	}

	isValid := true
	for _, ip := range ips {
		if isBlockedProxyIP(ip) {
			isValid = false
			break
		}
	}

	// Cache valid hosts for 1 hour, invalid for 5 minutes
	ttl := time.Hour
	if !isValid {
		ttl = 5 * time.Minute
	}
	proxyHostCache.Store(host, proxyHostCacheEntry{
		valid:     isValid,
		expiresAt: time.Now().Add(ttl),
	})

	return isValid
}

// isBlockedProxyIP indica si un proxy no debe conectarse a esta IP (red local,
// loopback, link-local como 169.254.169.254, etc.).
func isBlockedProxyIP(ip net.IP) bool {
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast()
}

// proxySafeDialer rechaza la conexión si la IP ya resuelta es interna. Control
// corre con la dirección final de cada conexión, así que cubre lo que
// IsValidProxyURL no ve: redirects hacia la red interna y DNS rebinding (el
// host validado y cacheado que después resuelve a 127.0.0.1).
var proxySafeDialer = &net.Dialer{
	Timeout:   30 * time.Second,
	KeepAlive: 30 * time.Second,
	Control: func(network, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		ip := net.ParseIP(host)
		if ip == nil || isBlockedProxyIP(ip) {
			return fmt.Errorf("proxy: conexión a %s bloqueada (SSRF)", address)
		}
		return nil
	},
}

// ProxySafeDialContext es el DialContext de los clientes HTTP que siguen URLs
// provistas por el cliente (/api/v1/proxy, /api/v1/image-proxy).
func ProxySafeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	return proxySafeDialer.DialContext(ctx, network, addr)
}

// proxyRequestHeaderAllowlist son las cabeceras que el cliente puede pedir que
// el proxy mande al upstream (lo que exigen algunos hosts de video/imágenes).
// Todo lo demás (Host, Authorization, X-Forwarded-*, …) se descarta.
var proxyRequestHeaderAllowlist = map[string]bool{
	"Referer":         true,
	"Origin":          true,
	"User-Agent":      true,
	"Accept-Language": true,
	"Cookie":          true,
}

// FilterProxyRequestHeaders devuelve solo las cabeceras permitidas, con el
// nombre canónico.
func FilterProxyRequestHeaders(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		ck := http.CanonicalHeaderKey(strings.TrimSpace(k))
		if proxyRequestHeaderAllowlist[ck] && !strings.ContainsAny(v, "\r\n") {
			out[ck] = v
		}
	}
	return out
}
