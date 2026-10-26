package mkvsubs

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"

	"kamehouse/internal/drive"
	"kamehouse/internal/mkvsubs/mkvtest"

	"github.com/stretchr/testify/require"
)

func mb(n int64) float64 { return float64(n) / (1 << 20) }

// Modelo de costo de una descarga de Drive: latencia por petición (~0.4 s hasta el
// primer byte), peticiones en paralelo y ancho de banda sostenido.
const (
	modelLatency   = 0.4
	modelParallel  = 8
	modelBandwidth = 40 << 20 // bytes/s
)

func modelSeconds(reqs, bytes int64, parallel int) float64 {
	return float64(reqs)*modelLatency/float64(parallel) + float64(bytes)/modelBandwidth
}

// walkWindow recorre los clusters que cubren [fromMs, toMs] (como hace una ventana).
func walkWindow(t testing.TB, f *File, fromMs, toMs int64) int {
	t.Helper()
	wanted := map[uint64]bool{}
	for _, tr := range f.SubtitleTracks() {
		wanted[tr.Number] = true
	}
	n := 0
	for off := f.ClusterBefore(fromMs); off >= 0; {
		cl, err := f.ReadCluster(context.Background(), off, wanted)
		require.NoError(t, err)
		n++
		if cl.StartMs >= toMs {
			break
		}
		off = cl.Next
	}
	return n
}

// TestMeasureDriveBytes compara cuántos bytes salen de Drive con cada estrategia de
// extraer los subtítulos de un MKV: ffmpeg sobre el loopback (lo de hoy), un lector
// que salta el payload de cada bloque de video/audio, y una ventana de tiempo sobre
// la caché de bloques. Con -v imprime la tabla. MKVSUBS_MEASURE_SECS=600 usa un
// episodio más largo (la proporción de la ventana baja con el largo del archivo).
func TestMeasureDriveBytes(t *testing.T) {
	secs := 90
	if v, err := strconv.Atoi(os.Getenv("MKVSUBS_MEASURE_SECS")); err == nil && v >= 30 {
		secs = v
	}
	tm := mkvtest.Get(t, secs)
	ffmpeg, err := exec.LookPath("ffmpeg")
	require.NoError(t, err)
	size := int64(len(tm.Bytes))
	// Bloques de ~1/64 del archivo: guardan la proporción de 16 MiB sobre ~1 GB.
	blockSize := max(size/64, 64<<10)
	t.Logf("archivo de prueba: %.1f MiB, %d s, bloques de caché de %d KiB (≈ %d bloques)", mb(size), tm.Secs, blockSize>>10, size/blockSize)

	newCache := func() (*mkvtest.FakeDrive, drive.RangeFetcher) {
		cache, err := drive.NewBlockCache(t.TempDir(), blockSize, 0)
		require.NoError(t, err)
		fd := &mkvtest.FakeDrive{Data: tm.Bytes}
		return fd, cache.Fetcher("fileTest123", fd.Fetch)
	}

	// ── A. Hoy: ffmpeg lee el archivo entero a través de /drive/play ────────────────
	fdA, fetchA := newCache()
	srvA := mkvtest.PlayServer(t, fetchA)
	outDir := t.TempDir()
	out, err := exec.Command(ffmpeg, "-y", "-v", "error",
		"-i", srvA.URL+"/file.mkv",
		"-map", "0:s:0", "-c:s", "copy", filepath.Join(outDir, "0.ass"),
		"-map", "0:s:1", "-c:s", "copy", filepath.Join(outDir, "1.srt")).CombinedOutput()
	require.NoError(t, err, string(out))
	bytesA, reqsA := fdA.Bytes(), fdA.Reqs()

	// ── A2. Después, el reproductor lee el archivo entero: no debe volver a Drive ────
	fdA.Reset()
	resp, err := http.Get(srvA.URL + "/file.mkv")
	require.NoError(t, err)
	n, _ := io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	require.Equal(t, size, n)
	bytesA2 := fdA.Bytes()
	require.Zero(t, bytesA2, "tras extraer, reproducir no debe volver a pedir bytes a Drive (comparten la caché de bloques)")

	// ── B. Lector que salta el payload (idea 2), sin caché, con distintas lecturas ───
	type sparseRow struct {
		chunk       int
		bytes, reqs int64
	}
	var sparse []sparseRow
	for _, chunk := range []int{2 << 10, 16 << 10, 64 << 10, 256 << 10} {
		fd := &mkvtest.FakeDrive{Data: tm.Bytes}
		f, err := Open(context.Background(), drive.NewRangeSource(fd.Fetch, size), Options{ChunkSize: chunk})
		require.NoError(t, err)
		evs := walkAll(t, f)
		require.Len(t, evs[f.SubtitleTracks()[0].Number], len(tm.ASSEvs), "el lector disperso debe encontrar todos los eventos")
		sparse = append(sparse, sparseRow{chunk, fd.Bytes(), fd.Reqs()})
	}

	// ── C. Ventana de tiempo sobre la caché de bloques ───────────────────────────────
	fdC, fetchC := newCache()
	fC, err := Open(context.Background(), drive.NewRangeSource(fetchC, size), Options{ChunkSize: 256 << 10})
	require.NoError(t, err)
	bytesOpen, reqsOpen := fdC.Bytes(), fdC.Reqs()
	walkWindow(t, fC, 0, 90_000)
	bytesW1, reqsW1 := fdC.Bytes(), fdC.Reqs()
	mid := int64(tm.Secs) * 1000 * 2 / 3
	walkWindow(t, fC, mid-30_000, mid+90_000)
	bytesW2, reqsW2 := fdC.Bytes(), fdC.Reqs()

	// ── Tabla ────────────────────────────────────────────────────────────────────────
	pct := func(b int64) float64 { return float64(b) / float64(size) * 100 }
	t.Logf("")
	t.Logf("%-58s %10s %8s %9s", "estrategia", "bytes", "% arch.", "peticiones")
	t.Logf("%-58s %9.1fM %7.1f%% %9d  (~%.0f s modelado)", "A  ffmpeg vía /drive/play (hoy: archivo entero)", mb(bytesA), pct(bytesA), reqsA, modelSeconds(reqsA, bytesA, 1))
	t.Logf("%-58s %9.1fM %7.1f%% %9s", "A2 reproducir después (caché compartida)", mb(bytesA2), pct(bytesA2), "0")
	for _, s := range sparse {
		t.Logf("%-58s %9.1fM %7.1f%% %9d  (~%.0f s con %d en paralelo)",
			fmt.Sprintf("B  saltar payload, lectura de %d KiB", s.chunk>>10), mb(s.bytes), pct(s.bytes), s.reqs,
			modelSeconds(s.reqs, s.bytes, modelParallel), modelParallel)
	}
	t.Logf("%-58s %9.1fM %7.1f%% %9d", "C0 abrir (cabecera + Cues, ya cacheado por ffprobe)", mb(bytesOpen), pct(bytesOpen), reqsOpen)
	t.Logf("%-58s %9.1fM %7.1f%% %9d", "C1 + ventana 0–90 s", mb(bytesW1), pct(bytesW1), reqsW1)
	t.Logf("%-58s %9.1fM %7.1f%% %9d", fmt.Sprintf("C2 + salto a %d–%d s", (mid-30_000)/1000, (mid+90_000)/1000), mb(bytesW2), pct(bytesW2), reqsW2)
	t.Logf("%-58s %9.1fM %7.1f%%", "C  solo la ventana 0–90 s, sin abrir", mb(bytesW1-bytesOpen), pct(bytesW1-bytesOpen))

	require.GreaterOrEqual(t, bytesA, size*95/100, "hoy se baja (casi) todo")
	require.LessOrEqual(t, bytesW2, bytesA)
	if secs >= 600 {
		require.Less(t, bytesW1, size*25/100, "en un episodio largo la ventana es una fracción chica")
	}
}
