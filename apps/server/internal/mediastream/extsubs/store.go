package extsubs

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"kamehouse/internal/mediastream/videofile"

	"golang.org/x/text/encoding/charmap"
)

// MaxFileSize es el tope por archivo de subtítulos externo (el reproductor descarta
// textos de más de 2 M de caracteres).
const MaxFileSize = 2 << 20

const manifestName = "index.json"

// Source es un candidato con la forma de obtener su contenido.
type Source struct {
	Candidate
	// Key identifica la versión del archivo (mtime:size, id:modified…); si no cambia
	// entre pedidos, se reutiliza la copia en caché sin volver a leer/descargar.
	Key string
	// Read devuelve el contenido crudo (como máximo MaxFileSize+1 bytes).
	Read func() ([]byte, error)
}

type manifest struct {
	Tracks []manifestTrack `json:"tracks"`
}

type manifestTrack struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
	Ext   string `json:"ext"`
	Key   string `json:"key"`
}

// Dir devuelve la carpeta de caché de los subtítulos externos de un medio. Se
// indexa por el hash de la ruta (local o gdrive://), nunca por texto del cliente.
func Dir(cacheDir, mediaPath string) string {
	sum := md5.Sum([]byte(mediaPath))
	return filepath.Join(cacheDir, "videofiles", "ext-"+hex.EncodeToString(sum[:]))
}

// FindFile devuelve la ruta del subtítulo externo con ese índice, o "" si no existe.
func FindFile(cacheDir, mediaPath string, index int) string {
	dir := Dir(cacheDir, mediaPath)
	prefix := strconv.Itoa(index) + "."
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), prefix) {
			return filepath.Join(dir, e.Name())
		}
	}
	return ""
}

// Sync deja en la caché las pistas externas de `sources` y devuelve cómo exponerlas
// en mediaInfo.subtitles. Las que no cambiaron (misma Key) no se vuelven a leer; las
// que ya no existen se borran. Un archivo ilegible, vacío o demasiado grande se omite
// sin abortar el resto. Con `sources` vacío limpia la carpeta.
func Sync(cacheDir, mediaPath string, sources []Source) ([]videofile.Subtitle, error) {
	dir := Dir(cacheDir, mediaPath)
	if len(sources) == 0 {
		_ = os.RemoveAll(dir)
		return nil, nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	var prev manifest
	if raw, err := os.ReadFile(filepath.Join(dir, manifestName)); err == nil {
		_ = json.Unmarshal(raw, &prev)
	}
	prevByKey := make(map[string]manifestTrack, len(prev.Tracks))
	for _, t := range prev.Tracks {
		prevByKey[t.Name+"\x00"+t.Key] = t
	}

	var next manifest
	var subs []videofile.Subtitle
	keep := map[string]bool{manifestName: true}
	for i, src := range sources {
		idx := IndexBase + i
		fname := fmt.Sprintf("%d.%s", idx, src.Ext)

		// Reutilizar solo si el contenido es el mismo Y quedó en el mismo índice.
		reused := false
		if t, ok := prevByKey[src.Name+"\x00"+src.Key]; ok && t.Index == idx && t.Ext == src.Ext && src.Key != "" {
			if _, err := os.Stat(filepath.Join(dir, fname)); err == nil {
				reused = true
			}
		}
		if !reused {
			data, err := src.Read()
			if err != nil || len(data) == 0 || len(data) > MaxFileSize {
				continue
			}
			data = NormalizeToUTF8(data)
			if len(bytes.TrimSpace(data)) == 0 {
				continue
			}
			if err := os.WriteFile(filepath.Join(dir, fname), data, 0o644); err != nil {
				continue
			}
		}
		keep[fname] = true
		next.Tracks = append(next.Tracks, manifestTrack{Index: idx, Name: src.Name, Ext: src.Ext, Key: src.Key})
		subs = append(subs, toSubtitle(idx, src.Candidate))
	}

	if raw, err := json.Marshal(next); err == nil {
		_ = os.WriteFile(filepath.Join(dir, manifestName), raw, 0o644)
	}
	if entries, err := os.ReadDir(dir); err == nil {
		for _, e := range entries {
			if !keep[e.Name()] {
				_ = os.RemoveAll(filepath.Join(dir, e.Name()))
			}
		}
	}
	return subs, nil
}

func toSubtitle(idx int, c Candidate) videofile.Subtitle {
	title := c.Title
	if title == "" {
		title = "Subtítulos externos"
	}
	if c.Forced && !strings.Contains(strings.ToLower(title), "forz") {
		title += " (forzado)"
	}
	ext := c.Ext
	link := fmt.Sprintf("/%d.%s", idx, ext)
	subtitle := videofile.Subtitle{
		Index:     uint32(idx),
		Title:     &title,
		Codec:     Codec(ext),
		Extension: &ext,
		IsForced:  c.Forced,
		Link:      &link,
	}
	if c.Lang != "" {
		lang := c.Lang
		subtitle.Language = &lang
	}
	return subtitle
}

// NormalizeToUTF8 deja el texto en UTF-8 sin BOM: detecta UTF-16 por BOM y, si no es
// UTF-8 válido, asume Windows-1252 (lo habitual en .srt viejos en español: á, ñ, ¿).
func NormalizeToUTF8(data []byte) []byte {
	switch {
	case bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}):
		return data[3:]
	case bytes.HasPrefix(data, []byte{0xFF, 0xFE}), bytes.HasPrefix(data, []byte{0xFE, 0xFF}):
		return decodeUTF16(data)
	}
	if utf8.Valid(data) {
		return data
	}
	if out, err := charmap.Windows1252.NewDecoder().Bytes(data); err == nil {
		return out
	}
	return data
}

func decodeUTF16(data []byte) []byte {
	littleEndian := data[0] == 0xFF
	data = data[2:]
	units := make([]uint16, 0, len(data)/2)
	for i := 0; i+1 < len(data); i += 2 {
		if littleEndian {
			units = append(units, uint16(data[i])|uint16(data[i+1])<<8)
		} else {
			units = append(units, uint16(data[i])<<8|uint16(data[i+1]))
		}
	}
	return []byte(string(utf16.Decode(units)))
}
