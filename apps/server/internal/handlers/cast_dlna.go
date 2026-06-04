package handlers

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// UPnPDevice represents a parsed UPnP device description from XML.
type UPnPDevice struct {
	XMLName      xml.Name      `xml:"root"`
	DeviceType   string        `xml:"device>deviceType"`
	FriendlyName string        `xml:"device>friendlyName"`
	Services     []UPnPService `xml:"device>serviceList>service"`
}

// UPnPService represents a service offered by a UPnP device.
type UPnPService struct {
	ServiceType string `xml:"serviceType"`
	ServiceID   string `xml:"serviceId"`
	SCPDURL     string `xml:"SCPDURL"`
	ControlURL  string `xml:"controlURL"`
	EventSubURL string `xml:"eventSubURL"`
}

// FetchDLNADeviceInfo retrieves and parses the device description XML from a LOCATION URL.
func FetchDLNADeviceInfo(locationURL string) (*UPnPDevice, error) {
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(locationURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch UPnP XML description, status: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var dev UPnPDevice
	// Use XML decoder to parse ignoring XML namespaces if any
	decoder := xml.NewDecoder(bytes.NewReader(bodyBytes))
	decoder.Entity = xml.HTMLEntity
	if err := decoder.Decode(&dev); err != nil {
		return nil, err
	}

	return &dev, nil
}

// ResolveURL helper resolves relative URLs based on the base location URL.
func ResolveURL(locationURL, relativePath string) (string, error) {
	if strings.HasPrefix(relativePath, "http://") || strings.HasPrefix(relativePath, "https://") {
		return relativePath, nil
	}
	base, err := url.Parse(locationURL)
	if err != nil {
		return "", err
	}
	ref, err := url.Parse(relativePath)
	if err != nil {
		return "", err
	}
	return base.ResolveReference(ref).String(), nil
}

// BuildDIDLMetadata generates escaped DIDL-Lite metadata for media player renderers.
func BuildDIDLMetadata(mediaURL, title string) string {
	escapedTitle := html.EscapeString(title)
	escapedURL := html.EscapeString(mediaURL)
	// We determine primitive content-type fallback. Usually video/* works well for DLNA.
	contentType := "video/mp4"
	if strings.Contains(mediaURL, ".m3u8") || strings.Contains(mediaURL, "/hls/") {
		contentType = "application/vnd.apple.mpegurl"
	}

	didl := fmt.Sprintf(
		`<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" `+
			`xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" `+
			`xmlns:dc="http://purl.org/dc/elements/1.1/">`+
			`<item id="0" parentID="0" restricted="1">`+
			`<dc:title>%s</dc:title>`+
			`<upnp:class>object.item.videoItem</upnp:class>`+
			`<res protocolInfo="http-get:*:%s:*">%s</res>`+
			`</item>`+
			`</DIDL-Lite>`,
		escapedTitle, contentType, escapedURL,
	)
	return html.EscapeString(didl)
}

// SendDLNASOAPAction sends a SOAP XML request to the DLNA renderer.
func SendDLNASOAPAction(controlURL, action, body string) error {
	soapEnvelope := fmt.Sprintf(
		`<?xml version="1.0" encoding="utf-8"?>`+
			`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">`+
			`<s:Body>%s</s:Body>`+
			`</s:Envelope>`,
		body,
	)

	req, err := http.NewRequest("POST", controlURL, strings.NewReader(soapEnvelope))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", `text/xml; charset="utf-8"`)
	req.Header.Set("SOAPACTION", fmt.Sprintf(`"urn:schemas-upnp-org:service:AVTransport:1#%s"`, action))
	req.Header.Set("Connection", "close")

	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("DLNA SOAP action %s failed (HTTP %d): %s", action, resp.StatusCode, string(respBody))
	}

	return nil
}

// DLNASetAVTransportURI sends the media URL to the DLNA renderer.
func DLNASetAVTransportURI(controlURL, mediaURL, title string) error {
	metadata := BuildDIDLMetadata(mediaURL, title)
	body := fmt.Sprintf(
		`<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">`+
			`<InstanceID>0</InstanceID>`+
			`<CurrentURI>%s</CurrentURI>`+
			`<CurrentURIMetaData>%s</CurrentURIMetaData>`+
			`</u:SetAVTransportURI>`,
		html.EscapeString(mediaURL), metadata,
	)

	return SendDLNASOAPAction(controlURL, "SetAVTransportURI", body)
}

// DLNAPlay sends the play command to the DLNA renderer.
func DLNAPlay(controlURL string) error {
	body := `<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">` +
		`<InstanceID>0</InstanceID>` +
		`<Speed>1</Speed>` +
		`</u:Play>`

	return SendDLNASOAPAction(controlURL, "Play", body)
}

// DLNAStop sends the stop command to the DLNA renderer.
func DLNAStop(controlURL string) error {
	body := `<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">` +
		`<InstanceID>0</InstanceID>` +
		`</u:Stop>`

	return SendDLNASOAPAction(controlURL, "Stop", body)
}
