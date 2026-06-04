package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/labstack/echo/v4"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// TVDevice represents a Samsung TV or DLNA renderer discovered on the local network.
type TVDevice struct {
	IP             string `json:"ip"`
	Name           string `json:"name"`
	WifiMac        string `json:"wifi_mac,omitempty"`
	EthernetMac    string `json:"ethernet_mac,omitempty"`
	DLNAControlURL string `json:"dlna_control_url,omitempty"`
}

// PairedTVDevice represents a TV that has been previously paired or cached.
type PairedTVDevice struct {
	IP             string `json:"ip"`
	Name           string `json:"name"`
	WifiMac        string `json:"wifi_mac,omitempty"`
	EthernetMac    string `json:"ethernet_mac,omitempty"`
	DLNAControlURL string `json:"dlna_control_url,omitempty"`
}

// SamsungLaunchPayload is the request body for the Samsung TV launch endpoint.
type SamsungLaunchPayload struct {
	IP             string `json:"ip"`
	URL            string `json:"url"`       // Direct stream URL to play
	Title          string `json:"title"`     // Optional title for cast player page
	StreamURL      string `json:"streamUrl"` // Alias, same as URL
	DLNAControlURL string `json:"dlna_control_url,omitempty"`
}

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

var (
	tokenFileLock sync.Mutex
	lastCastURLMu sync.RWMutex
	lastCastURL   string
)

// ---------------------------------------------------------------------------
// HTTP Handlers
// ---------------------------------------------------------------------------

// HandleSamsungDiscover scans the local network for Tizen Smart TVs using SSDP
// and falls back to HTTP health checks for previously paired TVs.
func (h *Handler) HandleSamsungDiscover(c echo.Context) error {
	devices, err := h.discoverSamsungTVs()
	if err != nil {
		devices = []TVDevice{}
	}

	h.enrichWithPairedTVs(&devices)

	return h.RespondWithData(c, devices)
}

// HandleSamsungPing checks if a specific Samsung TV is reachable via HTTP.
func (h *Handler) HandleSamsungPing(c echo.Context) error {
	ip := c.QueryParam("ip")
	if ip == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, fmt.Errorf("ip parameter required"))
	}

	online := isTVReachable(ip)
	return h.RespondWithData(c, map[string]bool{"online": online})
}

// HandleSamsungPaired returns the list of previously paired Samsung TVs.
func (h *Handler) HandleSamsungPaired(c echo.Context) error {
	devices := h.loadPairedTVs()
	return h.RespondWithData(c, devices)
}

// HandleSamsungLaunch launches a URL on a TV (via DLNA if supported, otherwise falling back to Samsung WebSocket browser launch).
func (h *Handler) HandleSamsungLaunch(c echo.Context) error {
	var payload SamsungLaunchPayload
	if err := c.Bind(&payload); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, err)
	}

	if payload.URL == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, fmt.Errorf("url is required"))
	}

	// Update the short link redirector URL
	lastCastURLMu.Lock()
	lastCastURL = payload.URL
	lastCastURLMu.Unlock()

	if payload.IP == "" {
		return h.RespondWithData(c, map[string]interface{}{"success": true})
	}

	// Try DLNA first if control URL is available (either in payload or saved tokens)
	dlnaControlURL := payload.DLNAControlURL
	if dlnaControlURL == "" {
		dlnaControlURL = h.getDLNAControlURL(payload.IP)
	}

	if dlnaControlURL != "" {
		mediaURL := extractMediaURL(payload.URL)
		title := extractTitle(payload.URL, payload.Title)
		fmt.Printf("[CAST] DLNA Control URL found for %s: %s. Initiating DLNA cast...\n", payload.IP, dlnaControlURL)

		// Call DLNA Stop first to clear any active session state
		_ = DLNAStop(dlnaControlURL)

		if err := DLNASetAVTransportURI(dlnaControlURL, mediaURL, title); err != nil {
			fmt.Printf("[CAST] DLNA SetAVTransportURI failed: %v. Falling back to WebSocket...\n", err)
		} else if err := DLNAPlay(dlnaControlURL); err != nil {
			fmt.Printf("[CAST] DLNA Play failed: %v. Falling back to WebSocket...\n", err)
		} else {
			fmt.Println("[CAST] DLNA casting started successfully")
			return h.RespondWithData(c, map[string]interface{}{"success": true})
		}
	}

	fmt.Printf("[CAST] DLNA not available or failed for %s. Attempting WebSocket browser launch...\n", payload.IP)
	if err := h.launchURLOnSamsungTV(payload.IP, payload.URL); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{"success": true})
}

func extractMediaURL(inputURL string) string {
	u, err := url.Parse(inputURL)
	if err != nil {
		return inputURL
	}
	if strings.Contains(u.Path, "/cast/player") {
		mediaURL := u.Query().Get("url")
		if mediaURL != "" {
			return mediaURL
		}
	}
	return inputURL
}

func extractTitle(inputURL string, defaultTitle string) string {
	if defaultTitle == "" {
		defaultTitle = "KameHouse"
	}
	u, err := url.Parse(inputURL)
	if err != nil {
		return defaultTitle
	}
	if strings.Contains(u.Path, "/cast/player") {
		title := u.Query().Get("title")
		if title != "" {
			return title
		}
	}
	return defaultTitle
}

