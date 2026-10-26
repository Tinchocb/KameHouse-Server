// Package mkvtest es apoyo para pruebas: genera un MKV parecido a un episodio (con
// ffmpeg) y un Google Drive falso que sirve archivos por rangos y cuenta lo que sale.
// No lo importa código de producción.
package mkvtest

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"kamehouse/internal/drive"
)

// Event es una línea de subtítulo que se metió al MKV.
type Event struct {
	StartMs, EndMs int64
	Text           string
}

// MKV es el archivo de prueba: video con ruido (bloques grandes), audio, una pista ASS
// (índice 0, "spa"), una SRT (índice 1, "eng") y una fuente adjunta, con clusters de
// ~5 s como los de mkvmerge.
type MKV struct {
	Path   string
	Bytes  []byte
	ASSEvs []Event
	SRTEvs []Event
	Secs   int
}

// FontName y FontData son la fuente adjunta del MKV de prueba.
const FontName = "Fake-Font.ttf"

var FontData = strings.Repeat("FONTDATA", 512)

// Get devuelve (generándolo la primera vez) un MKV de `secs` segundos. Se guarda en la
// carpeta temporal del sistema para compartirlo entre paquetes y corridas.
func Get(t testing.TB, secs int) *MKV {
	t.Helper()
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg no está disponible")
	}
	dir := filepath.Join(os.TempDir(), fmt.Sprintf("kamehouse-mkvtest-v2-%d", secs))
	m := &MKV{Path: filepath.Join(dir, "ep.mkv"), Secs: secs}
	m.ASSEvs, m.SRTEvs = events(secs)
	if _, err := os.Stat(m.Path); err != nil {
		if err := build(ffmpeg, dir, m); err != nil {
			t.Fatal(err)
		}
	}
	if m.Bytes, err = os.ReadFile(m.Path); err != nil {
		t.Fatal(err)
	}
	return m
}

func events(secs int) (ass, srt []Event) {
	for i := 0; ; i++ {
		start := int64(i)*1500 + 200
		if start >= int64(secs-2)*1000 {
			break
		}
		end := start + 1200
		text := fmt.Sprintf("Linea %d, con coma y acento: ñandú", i)
		if i == 3 {
			end = start + 40000
			text = "Cartel largo"
		}
		ass = append(ass, Event{start, end, text})
	}
	for i := 0; ; i++ {
		start := int64(i)*2500 + 700
		if start >= int64(secs-2)*1000 {
			break
		}
		srt = append(srt, Event{start, start + 1800, fmt.Sprintf("Hello %d\nsecond line", i)})
	}
	return ass, srt
}

func build(ffmpeg, dir string, m *MKV) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	var ass, srt strings.Builder
	ass.WriteString("[Script Info]\nScriptType: v4.00+\nPlayResX: 640\nPlayResY: 360\n\n[V4+ Styles]\n" +
		"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n" +
		"Style: Default,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n" +
		"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
	for _, e := range m.ASSEvs {
		ass.WriteString(fmt.Sprintf("Dialogue: 0,%s,%s,Default,,0,0,0,,%s\n", assTime(e.StartMs), assTime(e.EndMs), e.Text))
	}
	for i, e := range m.SRTEvs {
		srt.WriteString(fmt.Sprintf("%d\n%s --> %s\n%s\n\n", i+1, srtTime(e.StartMs), srtTime(e.EndMs), e.Text))
	}
	// Se arma en una carpeta de trabajo propia y se publica con un rename: dos paquetes
	// de pruebas corriendo a la vez no se pisan.
	work, err := os.MkdirTemp(dir, "build-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	assPath, srtPath, fontPath := filepath.Join(work, "in.ass"), filepath.Join(work, "in.srt"), filepath.Join(work, FontName)
	for p, data := range map[string]string{assPath: ass.String(), srtPath: srt.String(), fontPath: FontData} {
		if err := os.WriteFile(p, []byte(data), 0o644); err != nil {
			return err
		}
	}
	out := filepath.Join(work, "ep.mkv")
	args := []string{
		"-y", "-v", "error",
		"-f", "lavfi", "-i", fmt.Sprintf("testsrc2=size=640x360:rate=24:duration=%d,noise=alls=22:allf=t", m.Secs),
		"-f", "lavfi", "-i", fmt.Sprintf("sine=frequency=440:duration=%d", m.Secs),
		"-i", assPath, "-i", srtPath,
		"-map", "0:v", "-map", "1:a", "-map", "2:0", "-map", "3:0",
		"-c:v", "libx264", "-preset", "ultrafast", "-b:v", "3M", "-g", "48", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "128k",
		"-c:s:0", "ass", "-c:s:1", "srt",
		"-metadata:s:s:0", "language=spa", "-metadata:s:s:1", "language=eng",
		"-cluster_time_limit", "5000", "-cluster_size_limit", "4M",
		"-attach", fontPath, "-metadata:s:t", "mimetype=application/x-truetype-font", "-metadata:s:t", "filename=" + FontName,
		out,
	}
	if o, err := exec.Command(ffmpeg, args...).CombinedOutput(); err != nil {
		return fmt.Errorf("ffmpeg: %v\n%s", err, o)
	}
	if err := os.Rename(out, m.Path); err != nil {
		if _, serr := os.Stat(m.Path); serr == nil {
			return nil // otro proceso lo publicó antes
		}
		return err
	}
	return nil
}

// AssTime formatea H:MM:SS.cc (ASS) y SrtTime HH:MM:SS,mmm.
func assTime(ms int64) string {
	cs := ms / 10
	return fmt.Sprintf("%d:%02d:%02d.%02d", cs/360000, cs/6000%60, cs/100%60, cs%100)
}

func srtTime(ms int64) string {
	return fmt.Sprintf("%02d:%02d:%02d,%03d", ms/3600000, ms/60000%60, ms/1000%60, ms%1000)
}

// ─── Drive falso ─────────────────────────────────────────────────────────────────────

// FakeDrive sirve un archivo por rangos y cuenta los bytes y las peticiones que salen.
type FakeDrive struct {
	Data  []byte
	bytes atomic.Int64
	reqs  atomic.Int64
	hook  atomic.Pointer[DriveHook]
	swap  atomic.Pointer[[]byte]
}

// SetData cambia el contenido del archivo (imita un reemplazo en Drive con el mismo ID).
func (d *FakeDrive) SetData(b []byte) { d.swap.Store(&b) }

func (d *FakeDrive) data() []byte {
	if p := d.swap.Load(); p != nil {
		return *p
	}
	return d.Data
}

// DriveHook decide qué le pasa a cada petición: n es el número de petición (desde 1).
// Devolver un error hace fallar la petición (un *drive.StreamStatusError imita a Drive); el
// hook también puede bloquearse (un Drive colgado) y debe volver si ctx se cancela.
type DriveHook func(ctx context.Context, n int64, rangeHeader string) error

func (d *FakeDrive) Bytes() int64 { return d.bytes.Load() }
func (d *FakeDrive) Reqs() int64  { return d.reqs.Load() }
func (d *FakeDrive) Reset()       { d.bytes.Store(0); d.reqs.Store(0) }

// SetHook instala (o con nil, quita) el hook de fallas. Es seguro llamarlo con lecturas
// en curso.
func (d *FakeDrive) SetHook(h DriveHook) {
	if h == nil {
		d.hook.Store(nil)
		return
	}
	d.hook.Store(&h)
}

// StatusError arma el error que da el cliente de Drive ante una respuesta no 2xx.
func StatusError(status int, body string) error {
	return &drive.StreamStatusError{Status: status, Body: body}
}

// QuotaError es el 403 "downloadQuotaExceeded".
func QuotaError() error {
	return StatusError(http.StatusForbidden, `{"error":{"errors":[{"reason":"downloadQuotaExceeded"}]}}`)
}

// Fetch es el drive.RangeFetcher del Drive falso.
func (d *FakeDrive) Fetch(ctx context.Context, rangeHeader string) (*http.Response, error) {
	n := d.reqs.Add(1)
	if h := d.hook.Load(); h != nil {
		if err := (*h)(ctx, n, rangeHeader); err != nil {
			return nil, err
		}
	}
	data := d.data()
	size := int64(len(data))
	start, end := int64(0), size-1
	if spec, ok := strings.CutPrefix(rangeHeader, "bytes="); ok {
		a, b, _ := strings.Cut(spec, "-")
		start, _ = strconv.ParseInt(a, 10, 64)
		if b != "" {
			end, _ = strconv.ParseInt(b, 10, 64)
		}
	}
	h := http.Header{}
	if start >= size {
		h.Set("Content-Range", fmt.Sprintf("bytes */%d", size))
		return &http.Response{StatusCode: http.StatusRequestedRangeNotSatisfiable, Header: h, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	if end >= size {
		end = size - 1
	}
	d.bytes.Add(end - start + 1)
	h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
	h.Set("Content-Type", "video/x-matroska")
	return &http.Response{
		StatusCode:    http.StatusPartialContent,
		Header:        h,
		ContentLength: end - start + 1,
		Body:          io.NopCloser(bytes.NewReader(data[start : end+1])),
	}, nil
}

// PlayServer imita HandleDrivePlay: un servidor de loopback que sirve el archivo con
// Range a través de `fetch` (normalmente la caché de bloques sobre el Drive falso).
func PlayServer(t testing.TB, fetch drive.RangeFetcher) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start, end := int64(0), int64(-1)
		hasRange := false
		if spec, ok := strings.CutPrefix(r.Header.Get("Range"), "bytes="); ok {
			hasRange = true
			a, b, _ := strings.Cut(spec, "-")
			start, _ = strconv.ParseInt(a, 10, 64)
			if b != "" {
				end, _ = strconv.ParseInt(b, 10, 64)
			}
		}
		cr, err := drive.OpenChunkedRange(r.Context(), fetch, start, end, drive.MediaChunkSize)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer cr.Body.Close()
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("Content-Length", strconv.FormatInt(cr.End-cr.Start+1, 10))
		if hasRange {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", cr.Start, cr.End, cr.Total))
			w.WriteHeader(http.StatusPartialContent)
		}
		_, _ = io.Copy(w, cr.Body)
	}))
	t.Cleanup(srv.Close)
	return srv
}
