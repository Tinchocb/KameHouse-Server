package handlers

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

// samsungTVTokenInfo stores the pairing token and device metadata for a Samsung TV.
type samsungTVTokenInfo struct {
	Token          string `json:"token"`
	Name           string `json:"name"`
	WifiMac        string `json:"wifi_mac,omitempty"`
	EthernetMac    string `json:"ethernet_mac,omitempty"`
	DLNAControlURL string `json:"dlna_control_url,omitempty"`
}

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

func (h *Handler) saveDLNAControlURL(ip string, controlURL string, name string) {
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
	info.DLNAControlURL = controlURL
	if name != "" {
		info.Name = name
	}

	tokens[ip] = info

	newBytes, err := json.MarshalIndent(tokens, "", "  ")
	if err == nil {
		_ = os.WriteFile(filePath, newBytes, 0644)
	}
}

func (h *Handler) getDLNAControlURL(ip string) string {
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

	return tokens[ip].DLNAControlURL
}


// ---------------------------------------------------------------------------
// Wake-on-LAN
// ---------------------------------------------------------------------------

// sendWakeOnLAN sends a magic packet to wake a TV from standby.
func sendWakeOnLAN(macStr string) error {
	mac, err := net.ParseMAC(macStr)
	if err != nil {
		return err
	}

	// Magic Packet: 6 bytes of 0xFF + 16 repetitions of the MAC address
	var packet [102]byte
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 1; i <= 16; i++ {
		copy(packet[i*6:(i+1)*6], mac)
	}

	bcastAddr, err := net.ResolveUDPAddr("udp", "255.255.255.255:9")
	if err != nil {
		return err
	}

	conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: 0})
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.WriteTo(packet[:], bcastAddr)
	return err
}

// ---------------------------------------------------------------------------
// WebSocket connection to Samsung TV
// ---------------------------------------------------------------------------

const (
	wsAppName       = "S2FtZUhvdXNlIFRW" // "KameHouse TV" in base64
	wsSecurePort    = 8002
	wsInsecurePort  = 8001
	wsHandshakeTime = 3 * time.Second
	wolRetries      = 7
	wolRetryDelay   = 1500 * time.Millisecond
)

// connectToTV establishes a WebSocket connection to the Samsung TV.
// It tries WSS (port 8002) first, then falls back to WS (port 8001),
// and finally attempts Wake-on-LAN if the TV is unreachable.
func (h *Handler) connectToTV(ip, savedToken string) (*websocket.Conn, *http.Response, error) {
	dialer := websocket.Dialer{
		HandshakeTimeout: wsHandshakeTime,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: true},
	}

	// Try secure WSS (port 8002) first
	wsURL := buildWSURL("wss", ip, wsSecurePort, savedToken)
	fmt.Printf("[CAST] Connecting to %s...\n", wsURL)

	conn, resp, err := dialer.Dial(wsURL, nil)
	if err == nil {
		return conn, resp, nil
	}
	fmt.Printf("[CAST] Port %d failed: %v. Trying port %d...\n", wsSecurePort, err, wsInsecurePort)

	// Try insecure WS (port 8001) fallback
	dialer.TLSClientConfig = nil
	wsURL = buildWSURL("ws", ip, wsInsecurePort, savedToken)
	conn, resp, err = dialer.Dial(wsURL, nil)
	if err == nil {
		return conn, resp, nil
	}

	// Both ports failed — try Wake-on-LAN
	return h.connectWithWoL(ip, savedToken)
}

// connectWithWoL sends WoL packets and retries the WebSocket connection.
func (h *Handler) connectWithWoL(ip, savedToken string) (*websocket.Conn, *http.Response, error) {
	macs := h.getMACsForTV(ip)
	if len(macs) == 0 {
		return nil, nil, fmt.Errorf("failed to connect to Samsung TV and no MAC addresses available for Wake-on-LAN")
	}

	fmt.Printf("[CAST] TV unreachable. Sending Wake-on-LAN to MACs: %v\n", macs)
	for _, mac := range macs {
		if err := sendWakeOnLAN(mac); err != nil {
			fmt.Printf("[CAST] WoL error for MAC %s: %v\n", mac, err)
		}
	}

	dialer := websocket.Dialer{HandshakeTimeout: wsHandshakeTime}

	for i := 0; i < wolRetries; i++ {
		time.Sleep(wolRetryDelay)
		fmt.Printf("[CAST] Retrying connection after WoL (attempt %d/%d)...\n", i+1, wolRetries)

		// Try secure first
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		wsURL := buildWSURL("wss", ip, wsSecurePort, savedToken)
		conn, resp, err := dialer.Dial(wsURL, nil)
		if err == nil {
			return conn, resp, nil
		}

		// Try insecure
		dialer.TLSClientConfig = nil
		wsURL = buildWSURL("ws", ip, wsInsecurePort, savedToken)
		conn, resp, err = dialer.Dial(wsURL, nil)
		if err == nil {
			return conn, resp, nil
		}
	}

	return nil, nil, fmt.Errorf("el televisor no respondió a los paquetes de encendido (Wake-on-LAN)")
}

// getMACsForTV reads stored MAC addresses for a given TV IP.
func (h *Handler) getMACsForTV(ip string) []string {
	tokenFileLock.Lock()
	defer tokenFileLock.Unlock()

	dir := h.App.Config.Data.AppDataDir
	filePath := filepath.Join(dir, "samsung_tokens.json")

	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}

	var tokens map[string]samsungTVTokenInfo
	if json.Unmarshal(fileBytes, &tokens) != nil {
		return nil
	}

	info, exists := tokens[ip]
	if !exists {
		return nil
	}

	var macs []string
	if info.WifiMac != "" {
		macs = append(macs, info.WifiMac)
	}
	if info.EthernetMac != "" {
		macs = append(macs, info.EthernetMac)
	}
	return macs
}

func buildWSURL(scheme, ip string, port int, token string) string {
	url := fmt.Sprintf("%s://%s:%d/api/v2/channels/samsung.remote.control?name=%s", scheme, ip, port, wsAppName)
	if token != "" {
		url = fmt.Sprintf("%s&token=%s", url, token)
	}
	return url
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

// waitForAuthorization reads WebSocket messages until the TV authorizes or rejects the connection.
func (h *Handler) waitForAuthorization(conn *websocket.Conn, ip, savedToken, targetURL string) error {
	waitDuration := 20 * time.Second
	if savedToken != "" {
		waitDuration = 3 * time.Second
	}
	conn.SetReadDeadline(time.Now().Add(waitDuration))

	for {
		_, msg, readErr := conn.ReadMessage()
		if readErr != nil {
			if savedToken != "" {
				fmt.Println("[CAST] Timeout with saved token, clearing and retrying...")
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

		if err := json.Unmarshal(msg, &payload); err != nil {
			continue
		}

		fmt.Printf("[CAST] Received TV event: %s\n", payload.Event)

		switch payload.Event {
		case "ms.channel.connect":
			if payload.Data.Token != "" {
				h.saveSamsungToken(ip, payload.Data.Token)
				fmt.Printf("[CAST] Saved new pairing token for TV %s\n", ip)
			}
			conn.SetReadDeadline(time.Time{}) // Reset deadline
			return nil

		case "ms.channel.unauthorized":
			if savedToken != "" {
				fmt.Println("[CAST] Token unauthorized, clearing and retrying...")
				h.saveSamsungToken(ip, "")
				return h.launchURLOnSamsungTV(ip, targetURL)
			}
			return fmt.Errorf("conexión no autorizada por el televisor. Por favor, acepta el permiso en la pantalla de la TV")
		}
	}
}

// ---------------------------------------------------------------------------
// App discovery + Browser launch
// ---------------------------------------------------------------------------

type tvAppItem struct {
	AppID string `json:"appId"`
	Name  string `json:"name"`
}

// Known Samsung browser app IDs ordered by likelihood
var knownBrowserIDs = []string{
	"org.tizen.browser",   // Tizen built-in browser (most models)
	"com.samsung.browser", // Samsung Internet browser (newer models)
	"3201907018784",       // Samsung Internet app (2019+)
	"3202010022079",       // Samsung Internet app (alternative)
}

// fetchInstalledApps requests the list of installed apps from the TV.
func fetchInstalledApps(conn *websocket.Conn) []tvAppItem {
	payload := map[string]interface{}{
		"method": "ms.channel.emit",
		"params": map[string]interface{}{
			"event": "ed.installedApp.get",
			"to":    "host",
		},
	}

	msgBytes, err := json.Marshal(payload)
	if err != nil {
		return nil
	}

	fmt.Println("[CAST] Requesting installed apps list...")
	_ = conn.WriteMessage(websocket.TextMessage, msgBytes)

	conn.SetReadDeadline(time.Now().Add(1200 * time.Millisecond))
	defer conn.SetReadDeadline(time.Time{})

	for {
		_, msg, readErr := conn.ReadMessage()
		if readErr != nil {
			break
		}
		var appResp struct {
			Event string      `json:"event"`
			Data  []tvAppItem `json:"data"`
		}
		if json.Unmarshal(msg, &appResp) == nil && appResp.Event == "ed.installedApp.get" {
			fmt.Printf("[CAST] Retrieved %d installed apps from TV\n", len(appResp.Data))
			return appResp.Data
		}
	}

	return nil
}

// findBrowserAppID determines the correct browser app ID from installed apps.
func findBrowserAppID(installedApps []tvAppItem) string {
	if len(installedApps) == 0 {
		return ""
	}

	// First pass: exact match with known browser IDs
	for _, app := range installedApps {
		idLower := strings.ToLower(app.AppID)
		for _, knownID := range knownBrowserIDs {
			if strings.ToLower(knownID) == idLower {
				fmt.Printf("[CAST] Matched browser App ID: %s (%s)\n", app.AppID, app.Name)
				return app.AppID
			}
		}
	}

	// Second pass: match by name
	browserKeywords := []string{"browser", "internet", "navegador"}
	for _, app := range installedApps {
		nameLower := strings.ToLower(app.Name)
		for _, kw := range browserKeywords {
			if strings.Contains(nameLower, kw) {
				fmt.Printf("[CAST] Found browser app by name: %s (%s)\n", app.AppID, app.Name)
				return app.AppID
			}
		}
	}

	// Log all apps for debugging
	fmt.Println("[CAST] No browser app found. Installed apps:")
	for _, app := range installedApps {
		fmt.Printf("[CAST]   - %s (%s)\n", app.AppID, app.Name)
	}

	return ""
}

// ---------------------------------------------------------------------------
// Launch strategies
// ---------------------------------------------------------------------------

type launchStrategy struct {
	actionType string
	metaTag    string
	dataMap    map[string]string
	label      string
}

// Samsung TVs differ in which launch command format they accept.
var defaultLaunchStrategies = func(targetURL string) []launchStrategy {
	return []launchStrategy{
		{actionType: "DEEP_LINK", metaTag: targetURL, label: "DEEP_LINK+metaTag"},
		{actionType: "NATIVE_LAUNCH", metaTag: targetURL, label: "NATIVE_LAUNCH+metaTag"},
		{actionType: "DEEP_LINK", dataMap: map[string]string{"url": targetURL}, label: "DEEP_LINK+data.url"},
	}
}

type wsLaunchPayload struct {
	Method string `json:"method"`
	Params struct {
		Event string `json:"event"`
		To    string `json:"to"`
		Data  struct {
			AppID      string            `json:"appId"`
			ActionType string            `json:"action_type"`
			MetaTag    string            `json:"metaTag,omitempty"`
			Data       map[string]string `json:"data,omitempty"`
		} `json:"data"`
	} `json:"params"`
}

// sendLaunchCommands tries multiple strategies to open the browser on the TV.
func sendLaunchCommands(conn *websocket.Conn, appIDs []string, targetURL string) {
	strategies := defaultLaunchStrategies(targetURL)

	fmt.Printf("[CAST] Target URL for TV browser: %s\n", targetURL)

	for _, appID := range appIDs {
		for sIdx, strategy := range strategies {
			var p wsLaunchPayload
			p.Method = "ms.channel.emit"
			p.Params.Event = "ed.apps.launch"
			p.Params.To = "host"
			p.Params.Data.AppID = appID
			p.Params.Data.ActionType = strategy.actionType
			p.Params.Data.MetaTag = strategy.metaTag
			p.Params.Data.Data = strategy.dataMap

			msgBytes, err := json.Marshal(p)
			if err != nil {
				continue
			}

			fmt.Printf("[CAST] Sending launch: AppID=%s Strategy=%s\n", appID, strategy.label)
			if err := conn.WriteMessage(websocket.TextMessage, msgBytes); err != nil {
				fmt.Printf("[CAST] Failed to send: %v\n", err)
				continue
			}

			// Check for TV response
			conn.SetReadDeadline(time.Now().Add(1500 * time.Millisecond))
			_, msg, readErr := conn.ReadMessage()
			conn.SetReadDeadline(time.Time{})

			if readErr == nil {
				fmt.Printf("[CAST] TV response: %s\n", string(msg))
				// Got a response — the command was accepted
				time.Sleep(500 * time.Millisecond)
				return
			}

			fmt.Printf("[CAST] No response for strategy %d (may still have worked)\n", sIdx)

			// If we have a matched app (single ID), trust the first strategy
			if sIdx == 0 && len(appIDs) == 1 {
				time.Sleep(500 * time.Millisecond)
				return
			}

			if sIdx < len(strategies)-1 {
				time.Sleep(800 * time.Millisecond)
			}
		}

		// Wait between different app IDs
		time.Sleep(1500 * time.Millisecond)
	}

	time.Sleep(500 * time.Millisecond)
	fmt.Println("[CAST] Launch sequence complete")
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

// launchURLOnSamsungTV connects to the TV via WebSocket, authorizes,
// detects the browser app, and launches the target URL.
func (h *Handler) launchURLOnSamsungTV(ip string, targetURL string) error {
	savedToken := h.getSamsungToken(ip)

	// 1. Connect
	conn, resp, err := h.connectToTV(ip, savedToken)
	if err != nil {
		return err
	}
	defer conn.Close()
	fmt.Printf("[CAST] Connected. HTTP Status: %d\n", resp.StatusCode)

	// 2. Authorize
	if err := h.waitForAuthorization(conn, ip, savedToken, targetURL); err != nil {
		return err
	}

	// 3. Detect browser app
	installedApps := fetchInstalledApps(conn)
	targetAppID := findBrowserAppID(installedApps)

	var appIDs []string
	if targetAppID != "" {
		appIDs = []string{targetAppID}
	} else {
		fmt.Println("[CAST] No browser matched. Trying all known IDs as fallback.")
		appIDs = knownBrowserIDs
	}

	// 4. Launch
	sendLaunchCommands(conn, appIDs, targetURL)
	return nil
}
