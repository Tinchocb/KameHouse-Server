package mkvsubs

import (
	"bytes"
	"fmt"
)

// Event es una línea de subtítulo ya decodificada.
type Event struct {
	StartMs int64
	EndMs   int64
	Data    []byte // payload del bloque, sin compresión de contenido
}

// fallbackDurationMs se usa si un bloque de subtítulo no declara duración.
const fallbackDurationMs = 3000

// NewEvent convierte un bloque de la pista en un evento: deshace la compresión de
// contenido y resuelve la duración (BlockDuration, o la duración por defecto de la
// pista, o un valor fijo).
func (t *Track) NewEvent(b Block) (Event, error) {
	data, err := t.decode(b.Data)
	if err != nil {
		return Event{}, err
	}
	dur := b.DurationMs
	if dur <= 0 && t.DefaultDurNs > 0 {
		dur = t.DefaultDurNs / 1_000_000
	}
	if dur <= 0 {
		dur = fallbackDurationMs
	}
	return Event{StartMs: b.StartMs, EndMs: b.StartMs + dur, Data: data}, nil
}

// Render arma el archivo de la pista (ASS completo o SRT) a partir de sus eventos, en
// el orden dado (orden del archivo, el mismo que escribe ffmpeg).
func Render(t *Track, events []Event) []byte {
	switch t.Format() {
	case FormatASS:
		return renderASS(t, events)
	case FormatSRT:
		return renderSRT(events)
	}
	return nil
}

const defaultASSEventsFormat = "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"

func renderASS(t *Track, events []Event) []byte {
	var out bytes.Buffer
	hdr := bytes.TrimRight(t.CodecPrivate, "\x00")
	nl := "\n"
	if bytes.Contains(hdr, []byte("\r\n")) {
		nl = "\r\n"
	}
	out.Write(hdr)
	if len(hdr) > 0 && !bytes.HasSuffix(hdr, []byte("\n")) {
		out.WriteString(nl)
	}
	if !bytes.Contains(hdr, []byte("[Events]")) {
		out.WriteString("[Events]" + nl + defaultASSEventsFormat + nl)
	}
	for _, e := range events {
		// ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text
		f := bytes.SplitN(bytes.TrimRight(e.Data, "\r\n"), []byte(","), 9)
		if len(f) < 9 {
			continue
		}
		out.WriteString("Dialogue: ")
		out.Write(f[1])
		out.WriteString("," + assTime(e.StartMs) + "," + assTime(e.EndMs) + ",")
		out.Write(bytes.Join(f[2:], []byte(",")))
		out.WriteString(nl)
	}
	return out.Bytes()
}

func renderSRT(events []Event) []byte {
	var out bytes.Buffer
	n := 0
	for _, e := range events {
		text := bytes.TrimSpace(bytes.ReplaceAll(e.Data, []byte("\r\n"), []byte("\n")))
		if len(text) == 0 {
			continue
		}
		n++
		fmt.Fprintf(&out, "%d\n%s --> %s\n", n, srtTime(e.StartMs), srtTime(e.EndMs))
		out.Write(text)
		out.WriteString("\n\n")
	}
	return out.Bytes()
}

func assTime(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	cs := ms / 10
	return fmt.Sprintf("%d:%02d:%02d.%02d", cs/360000, cs/6000%60, cs/100%60, cs%100)
}

func srtTime(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	return fmt.Sprintf("%02d:%02d:%02d,%03d", ms/3600000, ms/60000%60, ms/1000%60, ms%1000)
}
