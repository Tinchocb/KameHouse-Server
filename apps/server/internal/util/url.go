package util

import (
	"net"
	"net/url"
	"sync"
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
		if ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
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
