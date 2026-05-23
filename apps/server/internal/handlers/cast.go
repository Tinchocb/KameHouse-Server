package handlers

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type TVDevice struct {
	IP   string `json:"ip"`
	Name string `json:"name"`
}

// HandleSamsungDiscover scans the local network for Tizen Smart TVs
func (h *Handler) HandleSamsungDiscover(c echo.Context) error {
	devices, err := discoverSamsungTVs()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, devices)
}

func discoverSamsungTVs() ([]TVDevice, error) {
	ssdpAddr, err := net.ResolveUDPAddr("udp4", "239.255.255.250:1900")
	if err != nil {
		return nil, err
	}

	// Bind to wildcard address to receive incoming unicast replies on Windows
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: 0})
	if err != nil {
		fmt.Printf("[SSDP DEBUG] ListenUDP error: %v\n", err)
		return nil, err
	}
	defer conn.Close()

	// Send query targeting DIAL multiscreen services
	msearch := "M-SEARCH * HTTP/1.1\r\n" +
		"HOST: 239.255.255.250:1900\r\n" +
		"MAN: \"ssdp:discover\"\r\n" +
		"MX: 2\r\n" +
		"ST: urn:dial-multiscreen-org:service:dial:1\r\n\r\n"

	_, err = conn.WriteTo([]byte(msearch), ssdpAddr)
	if err != nil {
		fmt.Printf("[SSDP DEBUG] WriteTo error: %v\n", err)
		return nil, err
	}

	// Read responses with a 2.5 second timeout (giving MX: 2 room to complete)
	conn.SetReadDeadline(time.Now().Add(2500 * time.Millisecond))
	buf := make([]byte, 2048)

	foundIPs := make(map[string]bool)
	var devices []TVDevice

	fmt.Println("[SSDP DEBUG] Starting response read loop on 0.0.0.0...")
	for {
		n, addr, err := conn.ReadFrom(buf)
		if err != nil {
			fmt.Printf("[SSDP DEBUG] ReadFrom stop: %v\n", err)
			break // timeout or socket closed
		}

		resp := string(buf[:n])
		fmt.Printf("[SSDP DEBUG] Received response from %s: %s...\n", addr.String(), resp[:50])

		if strings.Contains(resp, "urn:dial-multiscreen-org:service:dial:1") ||
			strings.Contains(resp, "urn:dial-multiscreen-org:device:dialreceiver:1") ||
			strings.Contains(strings.ToLower(resp), "samsung") {
			ipStr, _, err := net.SplitHostPort(addr.String())
			if err != nil {
				ipStr = addr.String()
			}
			if !foundIPs[ipStr] {
				foundIPs[ipStr] = true
				name := fetchTVName(ipStr)
				devices = append(devices, TVDevice{
					IP:   ipStr,
					Name: name,
				})
			}
		}
	}

	return devices, nil
}

func fetchTVName(ip string) string {
	client := http.Client{
		Timeout: 500 * time.Millisecond,
	}
	resp, err := client.Get(fmt.Sprintf("http://%s:8001/api/v2/", ip))
	if err != nil {
		return "Samsung Smart TV"
	}
	defer resp.Body.Close()

	var result struct {
		Device struct {
			Name string `json:"name"`
		} `json:"device"`
		Name string `json:"name"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "Samsung Smart TV"
	}

	if result.Device.Name != "" {
		return result.Device.Name
	}
	if result.Name != "" {
		return result.Name
	}
	return "Samsung Smart TV"
}

type SamsungLaunchPayload struct {
	IP  string `json:"ip"`
	URL string `json:"url"`
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

	err := launchURLOnSamsungTV(payload.IP, payload.URL)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{"success": true})
}

func launchURLOnSamsungTV(ip string, targetURL string) error {
	// Try port 8002 (secure WSS) first since modern TVs (2018+) enforce it
	dialer := websocket.Dialer{
		HandshakeTimeout: 3 * time.Second,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: true},
	}

	wsURL := fmt.Sprintf("wss://%s:8002/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip) // "KameHouse TV" in base64
	fmt.Printf("[CAST DEBUG] Connecting directly to %s...\n", wsURL)
	conn, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		fmt.Printf("[CAST DEBUG] Port 8002 failed: %v. Trying port 8001 fallback...\n", err)
		// Fallback to port 8001 (unsecure WS) for older models
		dialer.TLSClientConfig = nil
		wsURL = fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control?name=S2FtZUhvdXNlIFRW", ip)
		conn, resp, err = dialer.Dial(wsURL, nil)
		if err != nil {
			return fmt.Errorf("failed to connect to Samsung TV: %w", err)
		}
	}
	defer conn.Close()
	fmt.Printf("[CAST DEBUG] Connection established. HTTP Status: %d\n", resp.StatusCode)

	// Set a short read deadline to check if the TV rejects us instantly with an unauthorized event
	conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	_, msg, readErr := conn.ReadMessage()
	if readErr == nil {
		var payload struct {
			Event string `json:"event"`
		}
		if json.Unmarshal(msg, &payload) == nil && payload.Event == "ms.channel.unauthorized" {
			fmt.Printf("[CAST DEBUG] Unauthorized on %s\n", wsURL)
			return fmt.Errorf("conexión no autorizada por el televisor. Por favor, acepta el permiso en la pantalla de la TV")
		}
	}
	// Reset read deadline for subsequent operations
	conn.SetReadDeadline(time.Time{})

	type LaunchData struct {
		AppID      string            `json:"appId"`
		ActionType string            `json:"action_type"`
		Data       map[string]string `json:"data"`
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

	// Enviar comando para los 3 App IDs de navegador más comunes en Tizen
	appIDs := []string{"org.tizen.browser", "3201907018784", "3202010022079"}
	for _, appID := range appIDs {
		payload := WebSocketPayload{
			Method: "ms.channel.emit",
			Params: LaunchParams{
				Event: "ed.apps.launch",
				To:    "host",
				Data: LaunchData{
					AppID:      appID,
					ActionType: "DEEP_LINK",
					Data: map[string]string{
						"url": targetURL,
					},
				},
			},
		}

		msgBytes, err := json.Marshal(payload)
		if err != nil {
			return err
		}

		fmt.Printf("[CAST DEBUG] Sending launch command for %s...\n", appID)
		err = conn.WriteMessage(websocket.TextMessage, msgBytes)
		if err != nil {
			return fmt.Errorf("failed to send launch command for %s: %w", appID, err)
		}
		// Breve retardo para que la cola de mensajes del TV procese cada petición
		time.Sleep(150 * time.Millisecond)
	}

	// Wait 500ms to allow command transmission before closing socket
	time.Sleep(500 * time.Millisecond)

	return nil
}
