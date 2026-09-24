package core

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"

	"kamehouse/internal/util"

	"github.com/rs/zerolog"
)

// renewThreshold is how early before expiry a self-signed certificate gets
// regenerated at startup. 30 days gives ample margin for a yearly cert.
const renewThreshold = 30 * 24 * time.Hour

// CertDaysLeft parses the first CERTIFICATE block in certPath and returns how
// many full days remain until NotAfter. It returns an error when the file is
// missing, has no parseable certificate, or is already expired.
func CertDaysLeft(certPath string) (int, error) {
	pemBytes, err := os.ReadFile(certPath)
	if err != nil {
		return 0, err
	}
	for {
		var block *pem.Block
		block, pemBytes = pem.Decode(pemBytes)
		if block == nil {
			return 0, fmt.Errorf("no parseable CERTIFICATE block in %s", certPath)
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return 0, err
		}
		remaining := time.Until(cert.NotAfter)
		if remaining <= 0 {
			return 0, fmt.Errorf("certificate expired on %s", cert.NotAfter.Format(time.RFC3339))
		}
		return int(remaining.Hours() / 24), nil
	}
}

func GenerateSelfSignedCert(certPath, keyPath string, logger *zerolog.Logger) error {
	// If both files already exist and the certificate is still valid for
	// longer than the renewal threshold, keep it untouched.
	if _, err := os.Stat(certPath); !os.IsNotExist(err) {
		if _, err := os.Stat(keyPath); !os.IsNotExist(err) {
			daysLeft, certErr := CertDaysLeft(certPath)
			if certErr != nil {
				logger.Warn().Err(certErr).Msg("app: Existing TLS certificate could not be parsed, regenerating it")
			} else if daysLeft > int(renewThreshold.Hours()/24) {
				logger.Info().Int("daysLeft", daysLeft).Msg("app: Existing TLS certificate is still valid")
				return nil
			} else {
				logger.Warn().Int("daysLeft", daysLeft).Msg("app: TLS certificate expiring soon, regenerating it")
			}
		}
	}

	logger.Info().Msg("app: Generating new self-signed TLS certificate and key")

	if err := os.MkdirAll(filepath.Dir(certPath), 0755); err != nil {
		return err
	}

	// generate private key with ECDSA (P256)
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return err
	}

	ips := []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}
	for _, ipStr := range util.GetLocalIPv4Addresses() {
		if ip := net.ParseIP(ipStr); ip != nil {
			ips = append(ips, ip)
		}
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"KameHouse Self-Signed"},
			CommonName:   "localhost",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(1, 0, 0),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		IPAddresses:           ips,
	}

	// Create certificate
	certBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &privKey.PublicKey, privKey)
	if err != nil {
		return err
	}

	// Save certificate with safe permissions
	certOut, err := os.OpenFile(certPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	if err := pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: certBytes}); err != nil {
		_ = certOut.Close()
		return err
	}
	if err := certOut.Close(); err != nil {
		return err
	}
	logger.Debug().Msgf("app: Wrote TLS certificate to %s", certPath)

	// Save private key
	keyOut, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	// Marshal ECDSA key to SEC 1, ASN.1 DER form
	privKeyBytes, err := x509.MarshalECPrivateKey(privKey)
	if err != nil {
		_ = keyOut.Close()
		return err
	}
	if err := pem.Encode(keyOut, &pem.Block{Type: "EC PRIVATE KEY", Bytes: privKeyBytes}); err != nil {
		_ = keyOut.Close()
		return err
	}
	if err := keyOut.Close(); err != nil {
		return err
	}
	logger.Debug().Msgf("app: Wrote TLS private key to %s", keyPath)

	return nil
}
