package core

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

const (
	ssdpAddr       = "239.255.255.250:1900"
	ssdpMaxPacket  = 2048
	ssdpNotifyAddr = "239.255.255.250:1900"
)

// SSDPAnnouncer listens for SSDP M-SEARCH requests and responds with
// the server's location so that KameHouseTV and other UPnP control
// points can discover the server automatically on the LAN.
type SSDPAnnouncer struct {
	logger   *zerolog.Logger
	port     int
	uuid     string
	running  bool
	mu       sync.Mutex
	cancel   func()
	wg       sync.WaitGroup
}

// NewSSDPAnnouncer creates a new SSDP announcer for the given HTTP port.
func NewSSDPAnnouncer(port int, logger *zerolog.Logger) *SSDPAnnouncer {
	return &SSDPAnnouncer{
		logger: logger,
		port:   port,
		uuid:   fmt.Sprintf("kamehouse-server-%d", port),
	}
}

// Start begins listening for SSDP M-SEARCH requests and sending periodic
// NOTIFY announcements. It is non-blocking.
func (s *SSDPAnnouncer) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.mu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	s.wg.Add(2)
	go s.listen(ctx)
	go s.notifyLoop(ctx)
}

// Stop gracefully shuts down the announcer.
func (s *SSDPAnnouncer) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	s.mu.Unlock()

	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
}

func (s *SSDPAnnouncer) listen(ctx context.Context) {
	defer s.wg.Done()

	addr, err := net.ResolveUDPAddr("udp4", ssdpAddr)
	if err != nil {
		s.logger.Warn().Err(err).Msg("ssdp: failed to resolve multicast address")
		return
	}

	conn, err := net.ListenMulticastUDP("udp4", nil, addr)
	if err != nil {
		s.logger.Warn().Err(err).Msg("ssdp: failed to listen on multicast (non-fatal)")
		return
	}
	defer conn.Close()
	_ = conn.SetReadBuffer(ssdpMaxPacket * 4)

	s.logger.Info().Str("addr", ssdpAddr).Msg("ssdp: listening for M-SEARCH")

	buf := make([]byte, ssdpMaxPacket)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, raddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			select {
			case <-ctx.Done():
				return
			default:
				continue
			}
		}

		if n > 0 && isMSEARCH(buf[:n]) {
			s.handleMSEARCH(conn, raddr, buf[:n])
		}
	}
}

func (s *SSDPAnnouncer) handleMSEARCH(conn *net.UDPConn, raddr *net.UDPAddr, msg []byte) {
	st := extractHeader(string(msg), "ST")
	s.logger.Debug().Str("st", st).Str("from", raddr.String()).Msg("ssdp: M-SEARCH received")

	// Build response with all matching STs
	location := fmt.Sprintf("http://%s:%d/api/v1/status", getBestLANIP(), s.port)
	server := fmt.Sprintf("KameHouse/%d", time.Now().Year())
	usn := fmt.Sprintf("uuid:%s::upnp:rootdevice", s.uuid)

	lines := []string{
		"HTTP/1.1 200 OK",
		"CACHE-CONTROL: max-age=1800",
		fmt.Sprintf("DATE: %s", time.Now().UTC().Format("Mon, 02 Jan 2006 15:04:05 GMT")),
		fmt.Sprintf("LOCATION: %s", location),
		fmt.Sprintf("SERVER: %s", server),
		fmt.Sprintf("ST: %s", st),
		fmt.Sprintf("USN: %s", usn),
		"EXT:",
	}

	resp := strings.Join(lines, "\r\n") + "\r\n\r\n"
	_, _ = conn.WriteToUDP([]byte(resp), raddr)
}

func (s *SSDPAnnouncer) notifyLoop(ctx context.Context) {
	defer s.wg.Done()

	// Send initial announcement after 1s
	time.Sleep(1 * time.Second)
	s.sendNOTIFY()

	ticker := time.NewTicker(1800 * time.Second) // every 30 min
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sendNOTIFY()
		}
	}
}

func (s *SSDPAnnouncer) sendNOTIFY() {
	location := fmt.Sprintf("http://%s:%d/api/v1/status", getBestLANIP(), s.port)
	server := fmt.Sprintf("KameHouse/%d", time.Now().Year())
	usn := fmt.Sprintf("uuid:%s::upnp:rootdevice", s.uuid)

	lines := []string{
		"NOTIFY * HTTP/1.1",
		"HOST: 239.255.255.250:1900",
		"CACHE-CONTROL: max-age=1800",
		fmt.Sprintf("LOCATION: %s", location),
		fmt.Sprintf("NT: upnp:rootdevice"),
		fmt.Sprintf("NTS: ssdp:alive"),
		fmt.Sprintf("SERVER: %s", server),
		fmt.Sprintf("USN: %s", usn),
	}

	resp := strings.Join(lines, "\r\n") + "\r\n\r\n"

	addr, err := net.ResolveUDPAddr("udp4", ssdpNotifyAddr)
	if err != nil {
		return
	}

	conn, err := net.DialUDP("udp4", nil, addr)
	if err != nil {
		return
	}
	defer conn.Close()

	_, _ = conn.Write([]byte(resp))
	s.logger.Debug().Msg("ssdp: NOTIFY sent")
}

func isMSEARCH(msg []byte) bool {
	return strings.HasPrefix(string(msg), "M-SEARCH")
}

func extractHeader(msg, header string) string {
	for _, line := range strings.Split(msg, "\r\n") {
		if strings.HasPrefix(strings.ToUpper(line), strings.ToUpper(header)+":") {
			return strings.TrimSpace(line[len(header)+1:])
		}
	}
	return "*"
}

// getBestLANIP returns the most appropriate LAN IP address.
func getBestLANIP() string {
	ips := getNonLoopbackIPv4s()
	if len(ips) == 0 {
		return "127.0.0.1"
	}

	// Prefer common private ranges
	for _, ip := range ips {
		if strings.HasPrefix(ip, "192.168.") {
			return ip
		}
	}
	for _, ip := range ips {
		if strings.HasPrefix(ip, "10.") {
			return ip
		}
	}
	for _, ip := range ips {
		if strings.HasPrefix(ip, "172.") {
			return ip
		}
	}

	return ips[0]
}

func getNonLoopbackIPv4s() []string {
	var result []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return result
	}
	for _, iface := range ifaces {
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
			if ip4 := ip.To4(); ip4 != nil {
				result = append(result, ip4.String())
			}
		}
	}
	return result
}
