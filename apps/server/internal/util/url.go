package util

import (
	"net/url"
	"strings"
)

// IsValidProxyURL tests whether a URL is secure to proxy (blocks SSRF to localhost/private network)
func IsValidProxyURL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || host == "127.0.0.1" || host == "[::1]" || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.") || strings.HasPrefix(host, "172.16.") || strings.HasPrefix(host, "169.254.") {
		return false
	}
	return true
}
