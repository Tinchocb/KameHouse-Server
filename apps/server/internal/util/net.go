package util

import (
	"net"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"
)

// ipCacheSnapshot es el último resultado de GetLocalIPv4Addresses con su vencimiento.
type ipCacheSnapshot struct {
	list      []string
	expiresAt time.Time
}

// Local IPs rarely change, so 30 s is a safe TTL that avoids repeated syscalls
// on hot paths like /api/v1/status which is called on every page load.
// Las lecturas son lock-free (atomic.Pointer); un vencimiento con ráfaga concurrente
// comparte un único recálculo vía singleflight.
var (
	ipCachePtr    atomic.Pointer[ipCacheSnapshot]
	ipCacheFlight singleflight.Group
	ipCacheTTL    = 30 * time.Second
)

// GetLocalIPv4Addresses retrieves all non-loopback local IPv4 addresses.
// Results are cached for ipCacheTTL to avoid repeated network-interface syscalls.
func GetLocalIPv4Addresses() []string {
	if snap := ipCachePtr.Load(); snap != nil && time.Now().Before(snap.expiresAt) {
		return snap.list
	}

	val, _, _ := ipCacheFlight.Do("ip_addresses", func() (any, error) {
		if snap := ipCachePtr.Load(); snap != nil && time.Now().Before(snap.expiresAt) {
			return snap.list, nil
		}

		var ipAddresses []string
		interfaces, err := net.Interfaces()
		if err != nil {
			return ipAddresses, nil
		}
		for _, iface := range interfaces {
			if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip == nil || ip.IsLoopback() {
					continue
				}
				ip = ip.To4()
				if ip == nil {
					continue
				}
				ipAddresses = append(ipAddresses, ip.String())
			}
		}

		ipCachePtr.Store(&ipCacheSnapshot{list: ipAddresses, expiresAt: time.Now().Add(ipCacheTTL)})
		return ipAddresses, nil
	})

	ips, _ := val.([]string)
	return ips
}
