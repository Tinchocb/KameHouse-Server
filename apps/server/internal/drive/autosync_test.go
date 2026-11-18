package drive

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestScanIntervalDefaultsAndClamps(t *testing.T) {
	require.Equal(t, 60*time.Minute, ScanInterval(0), "un intervalo nunca guardado usa el valor por defecto")
	require.Equal(t, 60*time.Minute, ScanInterval(-5))
	require.Equal(t, 15*time.Minute, ScanInterval(1), "no se baja de 15 minutos")
	require.Equal(t, 30*time.Minute, ScanInterval(30))
	require.Equal(t, 24*time.Hour, ScanInterval(100000), "como mucho una vez al día")
	require.Equal(t, MinScanIntervalMinutes, NormalizeScanIntervalMinutes(7))
}

// connectedService devuelve un servicio con cliente y carpeta, sin hablar con Google.
func connectedService(folderID string) *Service {
	return &Service{enabled: true, folderID: folderID, client: &Client{}}
}

func TestAutoScanFirstRunIsDueNow(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	s := connectedService("carpeta")
	require.True(t, s.AutoScanDue(now, time.Hour), "sin escaneos previos desde el arranque, toca ya")
	require.Equal(t, now, *s.NextAutoScanAt(now, time.Hour))
}

func TestAutoScanWaitsOneIntervalAfterASuccessfulRun(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	const interval = time.Hour
	s := connectedService("carpeta")

	// Escaneo de 1 minuto que terminó hace 9: el siguiente toca 51 minutos después de que terminara.
	s.beginRun("carpeta", now.Add(-10*time.Minute))
	s.endRun(nil, now.Add(-9*time.Minute))

	require.False(t, s.AutoScanDue(now, interval))
	require.Equal(t, now.Add(51*time.Minute), *s.NextAutoScanAt(now, interval))
	require.True(t, s.AutoScanDue(now.Add(51*time.Minute), interval))
}

func TestAutoScanIntervalCountsFromTheEndOfALongScan(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	const interval = 15 * time.Minute
	s := connectedService("carpeta")

	// Un escaneo de 40 minutos, más largo que el intervalo, terminó hace un minuto: no se encadena.
	s.beginRun("carpeta", now.Add(-41*time.Minute))
	s.endRun(nil, now.Add(-time.Minute))

	require.False(t, s.AutoScanDue(now, interval))
	require.Equal(t, now.Add(14*time.Minute), *s.NextAutoScanAt(now, interval))
}

func TestAutoScanRetriesAFailedRunSoonerThanTheInterval(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	const interval = time.Hour
	s := connectedService("carpeta")

	// Falló hace 4 minutos: el reintento es 10 minutos después de que terminara, o sea en 6 minutos.
	s.beginRun("carpeta", now.Add(-5*time.Minute))
	s.endRun(errors.New("red caída"), now.Add(-4*time.Minute))

	require.False(t, s.AutoScanDue(now, interval), "el reintento espera 10 minutos desde el fallo")
	require.Equal(t, now.Add(6*time.Minute), *s.NextAutoScanAt(now, interval))
	require.True(t, s.AutoScanDue(now.Add(6*time.Minute), interval))
}

func TestAutoScanRunsAtOnceAfterTheFolderChanges(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)
	s := connectedService("carpeta")
	s.beginRun("carpeta", now.Add(-time.Minute))
	s.endRun(nil, now)
	require.False(t, s.AutoScanDue(now, time.Hour))

	s.folderID = "otra-carpeta"
	require.True(t, s.AutoScanDue(now, time.Hour), "elegir otra carpeta no espera al intervalo")
}

func TestAutoScanStaysQuietWhenNotConnectedOrScanning(t *testing.T) {
	now := time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)

	disconnected := connectedService("carpeta")
	disconnected.client = nil
	require.False(t, disconnected.AutoScanDue(now, time.Hour))
	require.Nil(t, disconnected.NextAutoScanAt(now, time.Hour))

	noFolder := connectedService("")
	require.False(t, noFolder.AutoScanDue(now, time.Hour))

	scanning := connectedService("carpeta")
	scanning.isScanning = true
	require.False(t, scanning.AutoScanDue(now, time.Hour), "no se encadena con un escaneo en curso")
	require.Nil(t, scanning.NextAutoScanAt(now, time.Hour))
}
