package handlers

import (
	"crypto/tls"
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

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type TVDevice struct {
	IP          string `json:"ip"`
	Name        string `json:"name"`
	WifiMac     string `json:"wifi_mac,omitempty"`
	EthernetMac string `json:"ethernet_mac,omitempty"`
}

type samsungTVTokenInfo struct {
	Token       string `json:"token"`
	Name        string `json:"name"`
	WifiMac     string `json:"wifi_mac,omitempty"`
	EthernetMac string `json:"ethernet_mac,omitempty"`
}

type PairedTVDevice struct {
	IP          string `json:"ip"`
	Name        string `json:"name"`
	WifiMac     string `json:"wifi_mac,omitempty"`
	EthernetMac string `json:"ethernet_mac,omitempty"`
}

// HandleSamsungDiscover scans the local network for Tizen Smart TVs
func (h *Handler) HandleSamsungDiscover(c echo.Context) error {
	devices, err := discoverSamsungTVs()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, devices)
}

// HandleSamsungPaired returns the list of previously paired Samsung TVs
func (h *Handler) HandleSamsungPaired(c echo.Context) error {
	tokenFileLock.Lock()
	defer tokenFileLock.Unlock()

	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")

	devices := []PairedTVDevice{}
	fileBytes, err := os.ReadFile(filePath)
	if err == nil {
		var tokens map[string]samsungTVTokenInfo
		if err := json.Unmarshal(fileBytes, &tokens); err == nil {
			for ip, info := range tokens {
				devices = append(devices, PairedTVDevice{
					IP:          ip,
					Name:        html.UnescapeString(info.Name),
					WifiMac:     info.WifiMac,
					EthernetMac: info.EthernetMac,
				})
			}
		}
	}

	return h.RespondWithData(c, devices)
}

func discoverSamsungTVs() ([]TVDevice, error) {
	ssdpAddr, err := net.ResolveUDPAddr("udp4", "239.255.255.250:1900")
	if err != nil {
		return nil, err
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	searchTargets := []string{
		"urn:dial-multiscreen-org:service:dial:1",
		"ssdp:all",
		"urn:schemas-upnp-org:device:MediaRenderer:1",
	}

	var mu sync.Mutex
	foundIPs := make(map[string]bool)
	var devices []TVDevice
	var wg sync.WaitGroup

	fmt.Println("[SSDP DEBUG] Starting multi-interface discovery...")

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

				conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: localIP, Port: 0})
				if err != nil {
					return
				}
				defer conn.Close()

				for _, st := range searchTargets {
					msearch := fmt.Sprintf("M-SEARCH * HTTP/1.1\r\n"+
						"HOST: 239.255.255.250:1900\r\n"+
						"MAN: \"ssdp:discover\"\r\n"+
						"MX: 2\r\n"+
						"ST: %s\r\n\r\n", st)
					conn.WriteTo([]byte(msearch), ssdpAddr)
				}

				conn.SetReadDeadline(time.Now().Add(2500 * time.Millisecond))
				buf := make([]byte, 2048)

				for {
					n, fromAddr, err := conn.ReadFrom(buf)
					if err != nil {
						break
					}

					resp := string(buf[:n])
					if strings.Contains(resp, "urn:dial-multiscreen-org:service:dial:1") ||
						strings.Contains(resp, "urn:dial-multiscreen-org:device:dialreceiver:1") ||
						strings.Contains(strings.ToLower(resp), "samsung") {

						ipStr, _, err := net.SplitHostPort(fromAddr.String())
						if err != nil {
							ipStr = fromAddr.String()
						}

						mu.Lock()
						if !foundIPs[ipStr] {
							foundIPs[ipStr] = true
							mu.Unlock() // Unlock for I/O

							name, wifiMac, ethernetMac := fetchTVInfo(ipStr)

							mu.Lock()
							devices = append(devices, TVDevice{
								IP:          ipStr,
								Name:        name,
								WifiMac:     wifiMac,
								EthernetMac: ethernetMac,
							})
							mu.Unlock()
						} else {
							mu.Unlock()
						}
					}
				}
			}(ipNet.IP)
		}
	}

	wg.Wait()
	return devices, nil
}

func fetchTVInfo(ip string) (name, wifiMac, ethernetMac string) {
	client := http.Client{
		Timeout: 500 * time.Millisecond,
	}
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

type SamsungLaunchPayload struct {
	IP        string `json:"ip"`
	URL       string `json:"url"`       // Direct stream URL to play
	Title     string `json:"title"`     // Optional title for cast player page
	StreamURL string `json:"streamUrl"` // Alias, same as URL
}

// HandleCastPlayer serves a minimal HTML5 video player page for Smart TVs
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

	// Detect stream type to decide which player to use
	isHLS := strings.HasSuffix(streamURL, ".m3u8") || strings.Contains(streamURL, "/hls/")
	var videoTag string
	var playerScript string
	if isHLS {
		videoTag = `<video id="v" autoplay controls playsinline></video>`
		// Use HLS.js for HLS streams (Samsung browser supports it)
		// We do NOT set the src attribute on the <video> tag directly to avoid conflicts with native media loader.
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

var (
	lastCastURLMu sync.RWMutex
	lastCastURL   string
)

// HandleCastGo redirects to the last cast URL for easy manual TV entry
func (h *Handler) HandleCastGo(c echo.Context) error {
	lastCastURLMu.RLock()
	url := lastCastURL
	lastCastURLMu.RUnlock()

	if url == "" {
		page := `<!DOCTYPE html>
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
		c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
		return c.String(http.StatusOK, page)
	}

	return c.Redirect(http.StatusTemporaryRedirect, url)
}

// HandleSamsungLaunch launches a URL on Tizen browser via WebSocket
func (h *Handler) HandleSamsungLaunch(c echo.Context) error {
	var payload SamsungLaunchPayload
	if err := c.Bind(&payload); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}

	if payload.IP == "" || payload.URL == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, fmt.Errorf("ip and url are required"))
	}

	// Update the short link redirector URL
	lastCastURLMu.Lock()
	lastCastURL = payload.URL
	lastCastURLMu.Unlock()

	err := h.launchURLOnSamsungTV(payload.IP, payload.URL)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{"success": true})
}

var tokenFileLock sync.Mutex

func (h *Handler) getSamsungToken(ip string) string {
	tokenFileLock.Lock()
	defer tokenFileLock.Unlock()

	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")

	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}

	var tokens map[string]samsungTVTokenInfo
	if err := json.Unmarshal(fileBytes, &tokens); err != nil {
		return ""
	}

	return tokens[ip].Token
}

func (h *Handler) saveSamsungToken(ip string, token string) {
	tokenFileLock.Lock()
	defer tokenFileLock.Unlock()

	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")

	tokens := make(map[string]samsungTVTokenInfo)
	fileBytes, err := os.ReadFile(filePath)
	if err == nil {
		_ = json.Unmarshal(fileBytes, &tokens)
	}

	info := tokens[ip]
	info.Token = token

	// If name or MAC info is empty, fetch it
	if info.Name == "" || (info.WifiMac == "" && info.EthernetMac == "") {
		name, wifiMac, ethernetMac := fetchTVInfo(ip)
		info.Name = name
		info.WifiMac = wifiMac
		info.EthernetMac = ethernetMac
	}

	tokens[ip] = info

	newBytes, err := json.MarshalIndent(tokens, "", "  ")
	if err == nil {
		_ = os.WriteFile(filePath, newBytes, 0644)
	}
}

func sendWakeOnLAN(macStr string) error {
	// Parse MAC address
	mac, err := net.ParseMAC(macStr)
	if err != nil {
		return err
	}

	// Construct Magic Packet: 6 bytes of 0xFF followed by 16 repetitions of MAC address
	var packet [102]byte
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 1; i <= 16; i++ {
		copy(packet[i*6:(i+1)*6], mac)
	}

	// Resolve broadcast UDP address
	bcastAddr, err := net.ResolveUDPAddr("udp", "255.255.255.255:9")
	if err != nil {
		return err
	}

	// Listen on local wildcard port and write to broadcast
	conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: 0})
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.WriteTo(packet[:], bcastAddr)
	return err
}

func (h *Handler) launchURLOnSamsungTV(ip string, targetURL string) error {
	savedToken := h.getSamsungToken(ip)

	// Try port 8002 (secure WSS) first since modern TVs (2018+) enforce it
	dialer := websocket.Dialer{
		HandshakeTimeout: 3 * time.Second,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: true},
	}

	wsURL := fmt.Sprintf("wss://%s:8002/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip) // "KameHouse TV" in base64
	if savedToken != "" {
		wsURL = fmt.Sprintf("%s&token=%s", wsURL, savedToken)
	}

	fmt.Printf("[CAST DEBUG] Connecting directly to %s...\n", wsURL)
	conn, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		fmt.Printf("[CAST DEBUG] Port 8002 failed: %v. Trying port 8001 fallback...\n", err)
		// Fallback to port 8001 (unsecure WS) for older models
		dialer.TLSClientConfig = nil
		wsURL = fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip)
		if savedToken != "" {
			wsURL = fmt.Sprintf("%s&token=%s", wsURL, savedToken)
		}
		conn, resp, err = dialer.Dial(wsURL, nil)
		if err != nil {
			// Connection failed. Try Wake-on-LAN!
			tokenFileLock.Lock()
			var macs []string
			dir := h.App.Config.Data.AppDataDir
			filePath := filepath.Join(dir, "samsung_tokens.json")
			if fileBytes, errRead := os.ReadFile(filePath); errRead == nil {
				var tokens map[string]samsungTVTokenInfo
				if json.Unmarshal(fileBytes, &tokens) == nil {
					if info, exists := tokens[ip]; exists {
						if info.WifiMac != "" {
							macs = append(macs, info.WifiMac)
						}
						if info.EthernetMac != "" {
							macs = append(macs, info.EthernetMac)
						}
					}
				}
			}
			tokenFileLock.Unlock()

			if len(macs) > 0 {
				fmt.Printf("[CAST DEBUG] TV is unreachable. Attempting Wake-on-LAN for MACs: %v...\n", macs)
				for _, mac := range macs {
					if errWoL := sendWakeOnLAN(mac); errWoL != nil {
						fmt.Printf("[CAST DEBUG] Wake-on-LAN error for MAC %s: %v\n", mac, errWoL)
					}
				}

				// Wait for TV to wake up and connect to network (we retry connecting every 1.5s, up to 10 seconds total)
				retries := 7
				connected := false
				for i := 0; i < retries; i++ {
					time.Sleep(1500 * time.Millisecond)
					fmt.Printf("[CAST DEBUG] Retrying connection after Wake-on-LAN (Attempt %d/%d)...\n", i+1, retries)

					// Re-try secure WSS first
					dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
					wsURL = fmt.Sprintf("wss://%s:8002/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip)
					if savedToken != "" {
						wsURL = fmt.Sprintf("%s&token=%s", wsURL, savedToken)
					}
					conn, resp, err = dialer.Dial(wsURL, nil)
					if err == nil {
						connected = true
						break
					}

					// Fallback to WS port 8001
					dialer.TLSClientConfig = nil
					wsURL = fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip)
					if savedToken != "" {
						wsURL = fmt.Sprintf("%s&token=%s", wsURL, savedToken)
					}
					conn, resp, err = dialer.Dial(wsURL, nil)
					if err == nil {
						connected = true
						break
					}
				}

				if !connected {
					return fmt.Errorf("el televisor no respondió a los paquetes de encendido (Wake-on-LAN)")
				}
			} else {
				return fmt.Errorf("failed to connect to Samsung TV: %w", err)
			}
		}
	}
	defer conn.Close()
	fmt.Printf("[CAST DEBUG] Connection established. HTTP Status: %d\n", resp.StatusCode)

	// We need to wait for the TV to authorize the connection.
	// If we have a saved token, the TV will approve it instantly (within 1-2 seconds).
	// If we don't have a saved token, we wait longer (e.g., 20 seconds) for the user to click "Allow" on their screen.
	waitDuration := 20 * time.Second
	if savedToken != "" {
		waitDuration = 3 * time.Second
	}
	conn.SetReadDeadline(time.Now().Add(waitDuration))

	authorized := false
	var newToken string
	for {
		_, msg, readErr := conn.ReadMessage()
		if readErr != nil {
			// If it timed out and we used a token, maybe the token was invalid/expired.
			// Let's clear the token and try again without a token to trigger pairing prompt.
			if savedToken != "" {
				fmt.Printf("[CAST DEBUG] Timeout or error with saved token, clearing and retrying without token...\n")
				h.saveSamsungToken(ip, "")
				return h.launchURLOnSamsungTV(ip, targetURL)
			}

			if netErr, ok := readErr.(net.Error); ok && netErr.Timeout() {
				return fmt.Errorf("tiempo de espera agotado. Por favor, asegúrate de aceptar el permiso en la pantalla de la TV")
			}
			return fmt.Errorf("error de lectura al conectar con la TV: %w", readErr)
		}

		var payload struct {
			Event string `json:"event"`
			Data  struct {
				Token string `json:"token"`
			} `json:"data"`
		}

		if err := json.Unmarshal(msg, &payload); err == nil {
			fmt.Printf("[CAST DEBUG] Received TV event: %s\n", payload.Event)
			if payload.Event == "ms.channel.connect" {
				authorized = true
				if payload.Data.Token != "" {
					newToken = payload.Data.Token
					h.saveSamsungToken(ip, newToken)
					fmt.Printf("[CAST DEBUG] Saved new pairing token for TV %s\n", ip)
				}
				break
			} else if payload.Event == "ms.channel.unauthorized" {
				if savedToken != "" {
					fmt.Printf("[CAST DEBUG] Token unauthorized, clearing and retrying without token...\n")
					h.saveSamsungToken(ip, "")
					return h.launchURLOnSamsungTV(ip, targetURL)
				}
				return fmt.Errorf("conexión no autorizada por el televisor. Por favor, acepta el permiso en la pantalla de la TV")
			}
		}
	}

	if !authorized {
		return fmt.Errorf("no se pudo establecer una conexión autorizada con el televisor")
	}

	// Reset read deadline
	conn.SetReadDeadline(time.Time{})

	type AppItem struct {
		AppID string `json:"appId"`
		Name  string `json:"name"`
	}
	var installedApps []AppItem

	// Request list of installed apps to identify the correct browser ID
	getAppsPayload := map[string]interface{}{
		"method": "ms.channel.emit",
		"params": map[string]interface{}{
			"event": "ed.installedApp.get",
			"to":    "host",
		},
	}
	if getAppsBytes, err := json.Marshal(getAppsPayload); err == nil {
		fmt.Println("[CAST DEBUG] Requesting installed apps list...")
		_ = conn.WriteMessage(websocket.TextMessage, getAppsBytes)

		// Set a short read deadline of 1.2 seconds to wait for response
		conn.SetReadDeadline(time.Now().Add(1200 * time.Millisecond))
		for {
			_, msg, readErr := conn.ReadMessage()
			if readErr != nil {
				break
			}
			var appResp struct {
				Event string    `json:"event"`
				Data  []AppItem `json:"data"`
			}
			if json.Unmarshal(msg, &appResp) == nil && appResp.Event == "ed.installedApp.get" {
				installedApps = appResp.Data
				fmt.Printf("[CAST DEBUG] Retrieved %d installed apps from TV\n", len(installedApps))
				break
			}
		}
		// Reset read deadline
		conn.SetReadDeadline(time.Time{})
	}

	// Try to match the browser App ID from the installed apps
	var targetAppID string
	possibleBrowserIDs := []string{"org.tizen.browser", "3201907018784", "3202010022079"}

	if len(installedApps) > 0 {
		// First pass: look for exact matches with our known browser IDs
		for _, app := range installedApps {
			idLower := strings.ToLower(app.AppID)
			for _, pID := range possibleBrowserIDs {
				if strings.ToLower(pID) == idLower {
					targetAppID = app.AppID
					fmt.Printf("[CAST DEBUG] Found matched browser App ID from installed apps: %s (%s)\n", targetAppID, app.Name)
					break
				}
			}
			if targetAppID != "" {
				break
			}
		}

		// Second pass: if no exact match, look for names containing "browser" or "internet"
		if targetAppID == "" {
			for _, app := range installedApps {
				nameLower := strings.ToLower(app.Name)
				if strings.Contains(nameLower, "browser") || strings.Contains(nameLower, "internet") {
					targetAppID = app.AppID
					fmt.Printf("[CAST DEBUG] Found browser app by name: %s (%s)\n", targetAppID, app.Name)
					break
				}
			}
		}
	}

	// Determine the list of App IDs to try launching
	var appIDsToLaunch []string
	if targetAppID != "" {
		appIDsToLaunch = []string{targetAppID}
	} else {
		fmt.Println("[CAST DEBUG] TV did not return app list or no browser app matched. Fallback to trying all known browser IDs.")
		appIDsToLaunch = possibleBrowserIDs
	}

	type LaunchData struct {
		AppID      string            `json:"appId"`
		ActionType string            `json:"action_type"`
		MetaTag    string            `json:"metaTag,omitempty"`
		Data       map[string]string `json:"data,omitempty"`
	}

	type LaunchParams struct {
		Event string     `json:"event"`
		To    string     `json:"to"`
		Data  LaunchData `json:"data"`
	}

	type WebSocketPayload struct {
		Method string       `json:"method"`
		Params LaunchParams `json:"params"`
	}

	for idx, appID := range appIDsToLaunch {
		// If we are fallback testing multiple app IDs, wait 2.5 seconds between different apps
		// to allow the correct browser to open without being cancelled by the next command.
		if idx > 0 {
			fmt.Printf("[CAST DEBUG] Waiting 2.5 seconds before trying next App ID fallback (%s)...\n", appID)
			time.Sleep(2500 * time.Millisecond)
		}

		// We only need NATIVE_LAUNCH for browser apps.
		// Sending multiple launch styles in rapid succession (every 200ms) can crash or lock the Tizen app launcher.
		p := WebSocketPayload{
			Method: "ms.channel.emit",
			Params: LaunchParams{
				Event: "ed.apps.launch",
				To:    "host",
				Data: LaunchData{
					AppID:      appID,
					ActionType: "NATIVE_LAUNCH",
					MetaTag:    targetURL,
				},
			},
		}

		msgBytes, err := json.Marshal(p)
		if err != nil {
			return err
		}

		fmt.Printf("[CAST DEBUG] Sending launch command for %s (NATIVE_LAUNCH)...\n", appID)
		err = conn.WriteMessage(websocket.TextMessage, msgBytes)
		if err != nil {
			return fmt.Errorf("failed to send launch command for %s: %w", appID, err)
		}
	}

	// Wait 500ms to allow command transmission before closing socket
	time.Sleep(500 * time.Millisecond)

	return nil
}
