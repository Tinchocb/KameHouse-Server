package core

import (
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"
)

func testLogger() *zerolog.Logger {
	l := zerolog.New(io.Discard)
	return &l
}

func TestGenerateSelfSignedCertKeepsValidCert(t *testing.T) {
	dir := t.TempDir()
	certPath := filepath.Join(dir, "certs", "cert.pem")
	keyPath := filepath.Join(dir, "certs", "key.pem")
	logger := testLogger()

	if err := GenerateSelfSignedCert(certPath, keyPath, logger); err != nil {
		t.Fatalf("first generation failed: %v", err)
	}
	daysLeft, err := CertDaysLeft(certPath)
	if err != nil {
		t.Fatalf("CertDaysLeft failed on fresh cert: %v", err)
	}
	if daysLeft < 300 {
		t.Errorf("fresh cert should be valid ~365 days, got %d", daysLeft)
	}

	infoBefore, _ := os.Stat(certPath)
	if err := GenerateSelfSignedCert(certPath, keyPath, logger); err != nil {
		t.Fatalf("second call failed: %v", err)
	}
	infoAfter, _ := os.Stat(certPath)
	if !infoAfter.ModTime().Equal(infoBefore.ModTime()) {
		t.Error("valid cert must not be regenerated on second call")
	}
}

func TestCertDaysLeftMissingFile(t *testing.T) {
	if _, err := CertDaysLeft(filepath.Join(t.TempDir(), "nope.pem")); err == nil {
		t.Error("expected error for missing file")
	}
}
