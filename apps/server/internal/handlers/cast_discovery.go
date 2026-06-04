package handlers

import (
	"encoding/json"
	"fmt"
	"html"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// SSDP Discovery
// ---------------------------------------------------------------------------

const (
	ssdpMulticastAddr = "239.255.255.250:1900"
	ssdpReadTimeout   = 3500 * time.Millisecond
	tvHTTPCheckTimeout = 1500 * time.Millisecond
	tvInfoTimeout      = 500 * time.Millisecond
	tvPingTimeout      = 2 * time.Second
)

var ssdpSearchTargets = []string{
	"urn:dial-multiscreen-org:service:dial:1",
	"ssdp:all",
	"urn:schemas-upnp-org:device:MediaRenderer:1",
}

// Helper to extract a header value from SSDP response
func getSSDPHeader(resp, header string) string {
	for _, line := range strings.Split(resp, "\r\n") {
		if strings.HasPrefix(strings.ToLower(line), strings.ToLower(header)+":") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

// resolveDLNADevice fetches and parses the device description XML to find friendly name and AVTransport control URL.
func resolveDLNADevice(locationURL string) (name, controlURL string, err error) {
	dev, err := FetchDLNADeviceInfo(locationURL)
	if err != nil {
		return "", "", err
	}

	var ctrlURL string
	for _, svc := range dev.Services {
		if strings.Contains(svc.ServiceType, "AVTransport") {
			resolved, err := ResolveURL(locationURL, svc.ControlURL)
			if err == nil {
				ctrlURL = resolved
				break
			}
		}
	}

	if ctrlURL == "" {
		return "", "", fmt.Errorf("no AVTransport service found in UPnP device")
	}

	name = dev.FriendlyName
	if name == "" {
		name = "DLNA Player"
	}
	return name, ctrlURL, nil
}

// discoverSamsungTVs performs SSDP multicast discovery across all network interfaces
// to find Samsung Smart TVs and generic DLNA Media Renderers on the local network.
func (h *Handler) discoverSamsungTVs() ([]TVDevice, error) {
	ssdpAddr, err := net.ResolveUDPAddr("udp4", ssdpMulticastAddr)
	if err != nil {
		return nil, err
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	var (
		mu       sync.Mutex
		foundIPs = make(map[string]bool)
		devices  []TVDevice
		wg       sync.WaitGroup
	)

	fmt.Println("[SSDP] Starting multi-interface discovery...")

	for _, intf := range interfaces {
		if intf.Flags&net.FlagUp == 0 || intf.Flags&net.FlagLoopback != 0 || intf.Flags&net.FlagMulticast == 0 {
			continue
		}

		addrs, err := intf.Addrs()
		if err != nil || len(addrs) == 0 {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.To4() == nil {
				continue
			}

			wg.Add(1)
			go func(localIP net.IP) {
				defer wg.Done()
				h.scanInterfaceForTVs(localIP, ssdpAddr, &mu, foundIPs, &devices)
			}(ipNet.IP)
		}
	}

	wg.Wait()
	return devices, nil
}

// scanInterfaceForTVs sends SSDP M-SEARCH packets from a specific local IP
// and collects DLNA Media Renderer / Samsung TV responses.
func (h *Handler) scanInterfaceForTVs(localIP net.IP, ssdpAddr *net.UDPAddr, mu *sync.Mutex, foundIPs map[string]bool, devices *[]TVDevice) {
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: localIP, Port: 0})
	if err != nil {
		return
	}
	defer conn.Close()

	// Send M-SEARCH for each target
	for _, st := range ssdpSearchTargets {
		msearch := fmt.Sprintf("M-SEARCH * HTTP/1.1\r\n"+
			"HOST: %s\r\n"+
			"MAN: \"ssdp:discover\"\r\n"+
			"MX: 2\r\n"+
			"ST: %s\r\n\r\n", ssdpMulticastAddr, st)
		conn.WriteTo([]byte(msearch), ssdpAddr)
	}

	conn.SetReadDeadline(time.Now().Add(ssdpReadTimeout))
	buf := make([]byte, 2048)

	for {
		n, fromAddr, err := conn.ReadFrom(buf)
		if err != nil {
			break
		}

		resp := string(buf[:n])
		if !isCastableDeviceResponse(resp) {
			continue
		}

		ipStr, _, err := net.SplitHostPort(fromAddr.String())
		if err != nil {
			ipStr = fromAddr.String()
		}

		locationURL := getSSDPHeader(resp, "LOCATION")
		var dlnaControlURL string
		var friendlyName string

		if locationURL != "" {
			name, ctrlURL, err := resolveDLNADevice(locationURL)
			if err == nil {
				dlnaControlURL = ctrlURL
				friendlyName = name
			}
		}

		mu.Lock()
		if foundIPs[ipStr] {
			// If already found, update DLNA control URL if available
			for i, d := range *devices {
				if d.IP == ipStr && d.DLNAControlURL == "" && dlnaControlURL != "" {
					(*devices)[i].DLNAControlURL = dlnaControlURL
					if friendlyName != "" {
						(*devices)[i].Name = friendlyName
					}
					go h.saveDLNAControlURL(ipStr, dlnaControlURL, friendlyName)
				}
			}
			mu.Unlock()
			continue
		}
		foundIPs[ipStr] = true
		mu.Unlock()

		// Fetch TV info outside the lock
		name, wifiMac, ethernetMac := fetchTVInfo(ipStr)
		if friendlyName != "" {
			name = friendlyName
		}

		if dlnaControlURL != "" {
			go h.saveDLNAControlURL(ipStr, dlnaControlURL, name)
		}

		mu.Lock()
		*devices = append(*devices, TVDevice{
			IP:             ipStr,
			Name:           name,
			WifiMac:        wifiMac,
			EthernetMac:    ethernetMac,
			DLNAControlURL: dlnaControlURL,
		})
		mu.Unlock()
	}
}

// isCastableDeviceResponse checks if an SSDP response belongs to a Samsung TV or DLNA Media Renderer.
func isCastableDeviceResponse(resp string) bool {
	return strings.Contains(resp, "urn:dial-multiscreen-org:service:dial:1") ||
		strings.Contains(resp, "urn:dial-multiscreen-org:device:dialreceiver:1") ||
		strings.Contains(strings.ToLower(resp), "samsung") ||
		strings.Contains(resp, "urn:schemas-upnp-org:device:MediaRenderer:1")
}

// ---------------------------------------------------------------------------
// Paired TV HTTP fallback
// ---------------------------------------------------------------------------

// enrichWithPairedTVs checks previously paired TVs via HTTP and adds any
// that are online but were missed by SSDP discovery.
func (h *Handler) enrichWithPairedTVs(devices *[]TVDevice) {
	tokenFileLock.Lock()
	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")
	fileBytes, errRead := os.ReadFile(filePath)
	tokenFileLock.Unlock()

	if errRead != nil {
		return
	}

	var tokens map[string]samsungTVTokenInfo
	if err := json.Unmarshal(fileBytes, &tokens); err != nil {
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for ip, info := range tokens {
		if containsIP(*devices, ip) {
			fmt.Printf("[DISCOVER] Paired TV %s (%s) already found by SSDP\n", ip, info.Name)
			continue
		}

		wg.Add(1)
		go func(tvIP string, tvInfo samsungTVTokenInfo) {
			defer wg.Done()
			fmt.Printf("[DISCOVER] Checking paired TV %s (%s) via HTTP...\n", tvIP, tvInfo.Name)

			if !isTVReachable(tvIP) {
				fmt.Printf("[DISCOVER] Paired TV %s (%s) is OFFLINE\n", tvIP, tvInfo.Name)
				return
			}

			fmt.Printf("[DISCOVER] Paired TV %s (%s) is ONLINE\n", tvIP, tvInfo.Name)
			name, wifiMac, ethernetMac := fetchTVInfo(tvIP)

			mu.Lock()
			*devices = append(*devices, TVDevice{
				IP:             tvIP,
				Name:           name,
				WifiMac:        wifiMac,
				EthernetMac:    ethernetMac,
				DLNAControlURL: tvInfo.DLNAControlURL,
			})
			mu.Unlock()
		}(ip, info)
	}

	wg.Wait()
}

// loadPairedTVs reads all previously paired TVs from the token file.
func (h *Handler) loadPairedTVs() []PairedTVDevice {
	tokenFileLock.Lock()
	defer tokenFileLock.Unlock()

	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")

	devices := []PairedTVDevice{}
	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return devices
	}

	var tokens map[string]samsungTVTokenInfo
	if err := json.Unmarshal(fileBytes, &tokens); err != nil {
		return devices
	}

	for ip, info := range tokens {
		devices = append(devices, PairedTVDevice{
			IP:             ip,
			Name:           html.UnescapeString(info.Name),
			WifiMac:        info.WifiMac,
			EthernetMac:    info.EthernetMac,
			DLNAControlURL: info.DLNAControlURL,
		})
	}
	return devices
}

// ---------------------------------------------------------------------------
// TV Info Fetching
// ---------------------------------------------------------------------------

// fetchTVInfo queries the Samsung TV HTTP API for its name and MAC addresses.
func fetchTVInfo(ip string) (name, wifiMac, ethernetMac string) {
	client := http.Client{Timeout: tvInfoTimeout}
	resp, err := client.Get(fmt.Sprintf("http://%s:8001/api/v2/", ip))
	if err != nil {
		return "Samsung Smart TV", "", ""
	}
	defer resp.Body.Close()

	var result struct {
		Device struct {
			Name        string `json:"name"`
			WifiMac     string `json:"wifiMac"`
			EthernetMac string `json:"ethernetMac"`
		} `json:"device"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "Samsung Smart TV", "", ""
	}

	name = "Samsung Smart TV"
	if result.Device.Name != "" {
		name = html.UnescapeString(result.Device.Name)
	} else if result.Name != "" {
		name = html.UnescapeString(result.Name)
	}

	return name, result.Device.WifiMac, result.Device.EthernetMac
}

// isTVReachable performs a quick HTTP health check against the TV's API.
func isTVReachable(ip string) bool {
	client := http.Client{Timeout: tvPingTimeout}
	resp, err := client.Get(fmt.Sprintf("http://%s:8001/api/v2/", ip))
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}

// containsIP checks if a device list already contains a TV with the given IP.
func containsIP(devices []TVDevice, ip string) bool {
	for _, d := range devices {
		if d.IP == ip {
			return true
		}
	}
	return false
}
