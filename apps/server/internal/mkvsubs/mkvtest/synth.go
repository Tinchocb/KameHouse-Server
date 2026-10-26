package mkvtest

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"fmt"
	"math"
	"sort"
)

// Generador de MKV sintéticos: no depende de ffmpeg ni de mkvmerge y permite armar,
// en milisegundos y de forma determinista, las variantes de estructura que tienen los
// archivos reales (clusters grandes, Cues escasas o ausentes, Segment de tamaño
// desconocido, Cues al final, lacing, varias pistas de subtítulos, compresión de
// contenido, relleno Void). El video y el audio son bytes de relleno: el archivo sirve
// para recorrerlo por rangos, no para reproducirlo.

// Tipos de pista de SynthTrack.Kind.
const (
	KindVideo = "video"
	KindAudio = "audio"
	KindASS   = "ass"
	KindSRT   = "srt"
	KindPGS   = "pgs"
)

// SynthTrack es una pista del archivo sintético. Los números de pista se asignan en
// orden (1, 2, 3...) salvo que Number venga puesto.
type SynthTrack struct {
	Kind string
	// CodecID reemplaza el predeterminado del tipo (por ejemplo "S_ASS", el alias viejo).
	CodecID string
	Number  uint64
	Lang    string
	Name    string
	// Events de las pistas de texto.
	Events []Event
	// NoDuration escribe los eventos como SimpleBlock sin BlockDuration (la duración sale
	// de la pista o del valor por defecto).
	NoDuration bool
	// DefaultDurMs es el DefaultDuration de la pista (0: no se escribe).
	DefaultDurMs int
	// Compress: "" sin compresión, "zlib" o "strip" (recorte de cabecera: quita "Linea "
	// del comienzo del payload; sirve para pistas SRT cuyo texto empieza así).
	Compress string
	// Lace agrupa los eventos que empiezan en el mismo instante en un solo bloque con
	// lacing de Xiph.
	Lace bool
}

// SynthOptions describe el archivo.
type SynthOptions struct {
	Secs int
	// Tracks: si está vacío, video + audio + una pista ASS "spa" + una SRT "eng".
	Tracks []SynthTrack
	// ClusterMs es la duración de cada cluster (5000 por defecto, como mkvmerge).
	ClusterMs int
	// FrameMs es el paso de los bloques de video y audio (100 por defecto).
	FrameMs int
	// VideoBytesPerSec fija el peso del video: define el tamaño del archivo y de cada
	// cluster. 0: 64 KiB/s.
	VideoBytesPerSec int
	// CuesEveryMs: una Cue cada tantos ms de video. 0: una por cluster; negativo: sin Cues.
	CuesEveryMs int
	// CuesFirst pone las Cues antes de los clusters (cues_to_front). Por defecto van al
	// final, apuntadas por el SeekHead.
	CuesFirst bool
	// NoSeekHead omite el SeekHead.
	NoSeekHead bool
	// UnknownSegmentSize escribe el Segment con tamaño desconocido.
	UnknownSegmentSize bool
	// UnknownClusterSize escribe los clusters con tamaño desconocido (como un directo).
	UnknownClusterSize bool
	// VoidBytes inserta un elemento Void de ese tamaño después del SeekHead y entre
	// Tracks y el primer cluster (mkvmerge reserva espacio así).
	VoidBytes int
	// CRC32 agrega un elemento CRC-32 al comienzo de cada cluster.
	CRC32 bool
	// Attachments: nombre -> datos.
	Attachments map[string]string
	// ScaleNs es el TimestampScale (1_000_000 por defecto).
	ScaleNs int64
}

// Synth es el resultado: los bytes y datos para verificar.
type Synth struct {
	Bytes []byte
	// Tracks con los números ya asignados.
	Tracks []SynthTrack
	// ClusterOffsets/ClusterStartMs: dónde y cuándo empieza cada cluster.
	ClusterOffsets []int64
	ClusterStartMs []int64
	// SubTrackNumbers: números de pista de las pistas de subtítulo, en orden de archivo.
	SubTrackNumbers []uint64
}

// Size es el tamaño del archivo.
func (s *Synth) Size() int64 { return int64(len(s.Bytes)) }

// DefaultSynthTracks: video, audio, ASS "spa" y SRT "eng" con eventos.
func DefaultSynthTracks(secs int) []SynthTrack {
	ass, srt := events(secs)
	return []SynthTrack{
		{Kind: KindVideo},
		{Kind: KindAudio, Lang: "jpn"},
		{Kind: KindASS, Lang: "spa", Name: "Español", Events: ass},
		{Kind: KindSRT, Lang: "eng", Name: "English", Events: srt},
	}
}

// ─── Codificación EBML ─────────────────────────────────────────────────────────────────

func idBytes(id uint32) []byte {
	switch {
	case id > 0xFFFFFF:
		return []byte{byte(id >> 24), byte(id >> 16), byte(id >> 8), byte(id)}
	case id > 0xFFFF:
		return []byte{byte(id >> 16), byte(id >> 8), byte(id)}
	case id > 0xFF:
		return []byte{byte(id >> 8), byte(id)}
	}
	return []byte{byte(id)}
}

// sizeBytes codifica un tamaño con el menor ancho posible; width > 0 lo fija.
func sizeBytes(n int64, width int) []byte {
	if width == 0 {
		width = 1
		for width < 8 && n >= (int64(1)<<(7*uint(width)))-1 {
			width++
		}
	}
	out := make([]byte, width)
	v := uint64(n) | uint64(1)<<(7*uint(width))
	for i := width - 1; i >= 0; i-- {
		out[i] = byte(v)
		v >>= 8
	}
	return out
}

var unknownSize = []byte{0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}

func el(id uint32, payload []byte) []byte {
	out := append(idBytes(id), sizeBytes(int64(len(payload)), 0)...)
	return append(out, payload...)
}

func uintBytes(v uint64) []byte {
	n := 1
	for n < 8 && v >= uint64(1)<<(8*uint(n)) {
		n++
	}
	out := make([]byte, n)
	for i := n - 1; i >= 0; i-- {
		out[i] = byte(v)
		v >>= 8
	}
	return out
}

func uintEl(id uint32, v uint64) []byte { return el(id, uintBytes(v)) }

// uintEl4 escribe siempre 4 bytes: el tamaño del elemento no depende del valor.
func uintEl4(id uint32, v uint64) []byte {
	return el(id, []byte{byte(v >> 24), byte(v >> 16), byte(v >> 8), byte(v)})
}

func strEl(id uint32, s string) []byte { return el(id, []byte(s)) }

func floatEl(id uint32, f float64) []byte {
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], math.Float64bits(f))
	return el(id, b[:])
}

func cat(parts ...[]byte) []byte { return bytes.Join(parts, nil) }

// ─── IDs ────────────────────────────────────────────────────────────────────────────────

const (
	eEBML          = 0x1A45DFA3
	eEBMLVersion   = 0x4286
	eEBMLReadVer   = 0x42F7
	eEBMLMaxID     = 0x42F2
	eEBMLMaxSize   = 0x42F3
	eDocType       = 0x4282
	eDocTypeVer    = 0x4287
	eDocTypeRead   = 0x4285
	eSegment       = 0x18538067
	eSeekHead      = 0x114D9B74
	eSeek          = 0x4DBB
	eSeekID        = 0x53AB
	eSeekPos       = 0x53AC
	eInfo          = 0x1549A966
	eTimestampScl  = 0x2AD7B1
	eDuration      = 0x4489
	eMuxingApp     = 0x4D80
	eWritingApp    = 0x5741
	eTracks        = 0x1654AE6B
	eTrackEntry    = 0xAE
	eTrackNumber   = 0xD7
	eTrackUID      = 0x73C5
	eTrackType     = 0x83
	eFlagLacing    = 0x9C
	eCodecID       = 0x86
	eCodecPrivate  = 0x63A2
	eLanguage      = 0x22B59C
	eTrackName     = 0x536E
	eDefaultDur    = 0x23E383
	eVideo         = 0xE0
	ePixelW        = 0xB0
	ePixelH        = 0xBA
	eAudio         = 0xE1
	eSamplingFreq  = 0xB5
	eChannels      = 0x9F
	eContentEncs   = 0x6D80
	eContentEnc    = 0x6240
	eContentOrder  = 0x5031
	eContentScope  = 0x5032
	eContentType   = 0x5033
	eContentComp   = 0x5034
	eContentAlgo   = 0x4254
	eContentSet    = 0x4255
	eAttachments   = 0x1941A469
	eAttachedFile  = 0x61A7
	eFileName      = 0x466E
	eFileMime      = 0x4660
	eFileData      = 0x465C
	eFileUID       = 0x46AE
	eCluster       = 0x1F43B675
	eTimecode      = 0xE7
	eSimpleBlock   = 0xA3
	eBlockGroup    = 0xA0
	eBlock         = 0xA1
	eBlockDuration = 0x9B
	eRefBlock      = 0xFB
	eCues          = 0x1C53BB6B
	eCuePoint      = 0xBB
	eCueTime       = 0xB3
	eCueTrackPos   = 0xB7
	eCueTrack      = 0xF7
	eCueClusterPos = 0xF1
	eVoid          = 0xEC
	eCRC32         = 0xBF
	eTags          = 0x1254C367
)

// ─── Armado ─────────────────────────────────────────────────────────────────────────────

const assHeaderForSynth = "[Script Info]\nScriptType: v4.00+\nPlayResX: 640\nPlayResY: 360\n\n[V4+ Styles]\n" +
	"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n" +
	"Style: Default,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n" +
	"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"

var noise = func() []byte {
	b := make([]byte, 1<<20)
	x := uint64(0x9E3779B97F4A7C15)
	for i := range b {
		x ^= x << 13
		x ^= x >> 7
		x ^= x << 17
		b[i] = byte(x)
	}
	return b
}()

func noiseAt(off, n int) []byte {
	off %= len(noise) - n
	return noise[off : off+n]
}

type timedItem struct {
	ms    int64
	order int
	data  []byte
}

func xiphLaces(frames [][]byte) []byte {
	out := []byte{byte(len(frames) - 1)}
	for _, f := range frames[:len(frames)-1] {
		n := len(f)
		for n >= 255 {
			out = append(out, 255)
			n -= 255
		}
		out = append(out, byte(n))
	}
	for _, f := range frames {
		out = append(out, f...)
	}
	return out
}

// BuildSynth arma el archivo.
func BuildSynth(o SynthOptions) *Synth {
	if o.ClusterMs <= 0 {
		o.ClusterMs = 5000
	}
	if o.FrameMs <= 0 {
		o.FrameMs = 100
	}
	if o.VideoBytesPerSec <= 0 {
		o.VideoBytesPerSec = 64 << 10
	}
	if o.ScaleNs <= 0 {
		o.ScaleNs = 1_000_000
	}
	tracks := append([]SynthTrack(nil), o.Tracks...)
	if len(tracks) == 0 {
		tracks = DefaultSynthTracks(o.Secs)
	}
	next := uint64(1)
	out := &Synth{}
	for i := range tracks {
		if tracks[i].Number == 0 {
			tracks[i].Number = next
		}
		next = tracks[i].Number + 1
		if tracks[i].Kind == KindASS || tracks[i].Kind == KindSRT || tracks[i].Kind == KindPGS {
			out.SubTrackNumbers = append(out.SubTrackNumbers, tracks[i].Number)
		}
	}
	out.Tracks = tracks
	toTicks := func(ms int64) int64 { return ms * 1_000_000 / o.ScaleNs }

	// Info
	info := el(eInfo, cat(
		uintEl(eTimestampScl, uint64(o.ScaleNs)),
		floatEl(eDuration, float64(o.Secs)*1000*1_000_000/float64(o.ScaleNs)),
		strEl(eMuxingApp, "kamehouse-synth"),
		strEl(eWritingApp, "kamehouse-synth"),
	))

	// Tracks
	var entries [][]byte
	for _, t := range tracks {
		var parts [][]byte
		parts = append(parts, uintEl(eTrackNumber, t.Number), uintEl(eTrackUID, 1000+t.Number))
		codec := t.CodecID
		switch t.Kind {
		case KindVideo:
			if codec == "" {
				codec = "V_MPEG4/ISO/AVC"
			}
			parts = append(parts, uintEl(eTrackType, 1), strEl(eCodecID, codec),
				el(eVideo, cat(uintEl(ePixelW, 1280), uintEl(ePixelH, 720))))
		case KindAudio:
			if codec == "" {
				codec = "A_AAC"
			}
			parts = append(parts, uintEl(eTrackType, 2), strEl(eCodecID, codec),
				el(eAudio, cat(floatEl(eSamplingFreq, 48000), uintEl(eChannels, 2))))
		case KindASS:
			if codec == "" {
				codec = "S_TEXT/ASS"
			}
			parts = append(parts, uintEl(eTrackType, 17), strEl(eCodecID, codec),
				el(eCodecPrivate, []byte(assHeaderForSynth)))
		case KindSRT:
			if codec == "" {
				codec = "S_TEXT/UTF8"
			}
			parts = append(parts, uintEl(eTrackType, 17), strEl(eCodecID, codec))
		case KindPGS:
			if codec == "" {
				codec = "S_HDMV/PGS"
			}
			parts = append(parts, uintEl(eTrackType, 17), strEl(eCodecID, codec))
		}
		if t.Lang != "" {
			parts = append(parts, strEl(eLanguage, t.Lang))
		}
		if t.Name != "" {
			parts = append(parts, strEl(eTrackName, t.Name))
		}
		if t.DefaultDurMs > 0 {
			parts = append(parts, uintEl(eDefaultDur, uint64(t.DefaultDurMs)*1_000_000))
		}
		switch t.Compress {
		case "zlib":
			parts = append(parts, el(eContentEncs, el(eContentEnc, cat(
				uintEl(eContentOrder, 0), uintEl(eContentScope, 1), uintEl(eContentType, 0),
				el(eContentComp, uintEl(eContentAlgo, 0))))))
		case "strip":
			parts = append(parts, el(eContentEncs, el(eContentEnc, cat(
				uintEl(eContentOrder, 0), uintEl(eContentScope, 1), uintEl(eContentType, 0),
				el(eContentComp, cat(uintEl(eContentAlgo, 3), el(eContentSet, []byte("Linea "))))))))
		}
		entries = append(entries, el(eTrackEntry, cat(parts...)))
	}
	tracksEl := el(eTracks, cat(entries...))

	// Adjuntos
	var attEl []byte
	if len(o.Attachments) > 0 {
		names := make([]string, 0, len(o.Attachments))
		for n := range o.Attachments {
			names = append(names, n)
		}
		sort.Strings(names)
		var files [][]byte
		for i, n := range names {
			files = append(files, el(eAttachedFile, cat(
				strEl(eFileName, n), strEl(eFileMime, "application/x-truetype-font"),
				uintEl(eFileUID, uint64(i+1)), el(eFileData, []byte(o.Attachments[n])))))
		}
		attEl = el(eAttachments, cat(files...))
	}

	// Eventos de subtítulos por pista, con su carga ya armada.
	type subBlock struct {
		trackNum uint64
		start    int64
		dur      int64
		payload  []byte
		group    bool
		lace     bool
		frames   [][]byte
	}
	var subs []subBlock
	for _, t := range tracks {
		if t.Kind != KindASS && t.Kind != KindSRT {
			continue
		}
		evs := append([]Event(nil), t.Events...)
		sort.SliceStable(evs, func(i, j int) bool { return evs[i].StartMs < evs[j].StartMs })
		enc := func(p []byte) []byte {
			switch t.Compress {
			case "zlib":
				var b bytes.Buffer
				w := zlib.NewWriter(&b)
				_, _ = w.Write(p)
				_ = w.Close()
				return b.Bytes()
			case "strip":
				return bytes.TrimPrefix(p, []byte("Linea "))
			}
			return p
		}
		for i := 0; i < len(evs); i++ {
			e := evs[i]
			var payload []byte
			if t.Kind == KindASS {
				payload = []byte(fmt.Sprintf("%d,0,Default,,0,0,0,,%s", i, e.Text))
			} else {
				payload = []byte(e.Text)
			}
			sb := subBlock{trackNum: t.Number, start: e.StartMs, dur: e.EndMs - e.StartMs, group: !t.NoDuration}
			if t.Lace {
				// Se juntan los eventos del mismo instante.
				frames := [][]byte{enc(payload)}
				for i+1 < len(evs) && evs[i+1].StartMs == e.StartMs {
					i++
					p2 := []byte(evs[i].Text)
					if t.Kind == KindASS {
						p2 = []byte(fmt.Sprintf("%d,0,Default,,0,0,0,,%s", i, evs[i].Text))
					}
					frames = append(frames, enc(p2))
				}
				if len(frames) > 1 {
					sb.lace, sb.frames = true, frames
				}
			}
			sb.payload = enc(payload)
			subs = append(subs, sb)
		}
	}
	sort.SliceStable(subs, func(i, j int) bool { return subs[i].start < subs[j].start })

	// Clusters
	nClusters := (o.Secs*1000 + o.ClusterMs - 1) / o.ClusterMs
	var clusterBytes [][]byte
	subIdx := 0
	videoFrame := o.VideoBytesPerSec * o.FrameMs / 1000
	if videoFrame < 16 {
		videoFrame = 16
	}
	frameNo := 0
	var videoNum, audioNum uint64
	for _, t := range tracks {
		if t.Kind == KindVideo && videoNum == 0 {
			videoNum = t.Number
		}
		if t.Kind == KindAudio && audioNum == 0 {
			audioNum = t.Number
		}
	}
	for c := 0; c < nClusters; c++ {
		cs := int64(c) * int64(o.ClusterMs)
		ce := cs + int64(o.ClusterMs)
		out.ClusterStartMs = append(out.ClusterStartMs, cs)
		var items []timedItem
		order := 0
		add := func(ms int64, data []byte) {
			items = append(items, timedItem{ms, order, data})
			order++
		}
		rel := func(ms int64) []byte {
			r := toTicks(ms) - toTicks(cs)
			return []byte{byte(r >> 8), byte(r)}
		}
		for ms := cs; ms < ce; ms += int64(o.FrameMs) {
			flags := byte(0x00)
			if ms == cs {
				flags = 0x80
			}
			if videoNum != 0 {
				vh := cat(sizeBytes(int64(videoNum), 0), rel(ms), []byte{flags})
				add(ms, el(eSimpleBlock, cat(vh, noiseAt(frameNo*37, videoFrame))))
			}
			if audioNum != 0 {
				ah := cat(sizeBytes(int64(audioNum), 0), rel(ms), []byte{0x80})
				add(ms, el(eSimpleBlock, cat(ah, noiseAt(frameNo*53+7, 200))))
			}
			frameNo++
		}
		for subIdx < len(subs) && subs[subIdx].start < ce {
			sb := subs[subIdx]
			subIdx++
			if sb.start < cs {
				continue
			}
			tn := sizeBytes(int64(sb.trackNum), 0)
			var body []byte
			flags := byte(0x00)
			if sb.lace {
				flags = 0x02
				body = xiphLaces(sb.frames)
			} else {
				body = sb.payload
			}
			hdr := cat(tn, rel(sb.start), []byte{flags})
			if sb.group {
				add(sb.start, el(eBlockGroup, cat(
					el(eBlock, cat(hdr, body)),
					uintEl(eBlockDuration, uint64(toTicks(sb.dur))),
				)))
			} else {
				add(sb.start, el(eSimpleBlock, cat(hdr, body)))
			}
		}
		sort.SliceStable(items, func(i, j int) bool {
			if items[i].ms != items[j].ms {
				return items[i].ms < items[j].ms
			}
			return items[i].order < items[j].order
		})
		var body [][]byte
		if o.CRC32 {
			body = append(body, el(eCRC32, []byte{0, 0, 0, 0}))
		}
		body = append(body, uintEl(eTimecode, uint64(toTicks(cs))))
		for _, it := range items {
			body = append(body, it.data)
		}
		payload := cat(body...)
		if o.UnknownClusterSize {
			clusterBytes = append(clusterBytes, cat(idBytes(eCluster), unknownSize, payload))
		} else {
			clusterBytes = append(clusterBytes, el(eCluster, payload))
		}
	}

	// Diseño del Segment (offsets relativos al primer byte del cuerpo).
	cuesOn := o.CuesEveryMs >= 0
	placeholderSeek := func(positions map[uint32]int64) []byte {
		var entries [][]byte
		for _, id := range []uint32{eInfo, eTracks, eAttachments, eCues} {
			if id == eAttachments && attEl == nil {
				continue
			}
			if id == eCues && !cuesOn {
				continue
			}
			entries = append(entries, el(eSeek, cat(el(eSeekID, idBytes(id)), uintEl4(eSeekPos, uint64(positions[id])))))
		}
		return el(eSeekHead, cat(entries...))
	}
	var seekLen int
	if !o.NoSeekHead {
		seekLen = len(placeholderSeek(map[uint32]int64{}))
	}
	var void1 []byte
	if o.VoidBytes > 0 {
		void1 = voidEl(o.VoidBytes)
	}

	buildCues := func(clusterPos []int64) []byte {
		step := o.CuesEveryMs
		var pts [][]byte
		lastCue := int64(-1 << 40)
		for c, pos := range clusterPos {
			cs := out.ClusterStartMs[c]
			if step > 0 && cs-lastCue < int64(step) && c != 0 {
				continue
			}
			lastCue = cs
			pts = append(pts, el(eCuePoint, cat(
				uintEl4(eCueTime, uint64(toTicks(cs))),
				el(eCueTrackPos, cat(uintEl(eCueTrack, 1), uintEl4(eCueClusterPos, uint64(pos)))),
			)))
		}
		return el(eCues, cat(pts...))
	}
	// El tamaño de las Cues no depende de las posiciones (anchos fijos): se calcula con ceros.
	var cuesLen int
	if cuesOn {
		cuesLen = len(buildCues(make([]int64, nClusters)))
	}

	pos := int64(seekLen) + int64(len(void1))
	infoPos := pos
	pos += int64(len(info))
	tracksPos := pos
	pos += int64(len(tracksEl))
	attPos := pos
	pos += int64(len(attEl))
	var cuesPos int64
	if cuesOn && o.CuesFirst {
		cuesPos = pos
		pos += int64(cuesLen)
	}
	var void2 []byte
	if o.VoidBytes > 0 {
		void2 = voidEl(o.VoidBytes)
		pos += int64(len(void2))
	}
	clusterPos := make([]int64, nClusters)
	for c, cb := range clusterBytes {
		clusterPos[c] = pos
		pos += int64(len(cb))
	}
	if cuesOn && !o.CuesFirst {
		cuesPos = pos
		pos += int64(cuesLen)
	}
	segBodyLen := pos

	var body bytes.Buffer
	if !o.NoSeekHead {
		body.Write(placeholderSeek(map[uint32]int64{eInfo: infoPos, eTracks: tracksPos, eAttachments: attPos, eCues: cuesPos}))
	}
	body.Write(void1)
	body.Write(info)
	body.Write(tracksEl)
	body.Write(attEl)
	var cuesBytes []byte
	if cuesOn {
		cuesBytes = buildCues(clusterPos)
	}
	if cuesOn && o.CuesFirst {
		body.Write(cuesBytes)
	}
	body.Write(void2)
	for _, cb := range clusterBytes {
		body.Write(cb)
	}
	if cuesOn && !o.CuesFirst {
		body.Write(cuesBytes)
	}
	if int64(body.Len()) != segBodyLen {
		panic(fmt.Sprintf("mkvtest: layout mismatch %d != %d", body.Len(), segBodyLen))
	}

	header := el(eEBML, cat(
		uintEl(eEBMLVersion, 1), uintEl(eEBMLReadVer, 1), uintEl(eEBMLMaxID, 4), uintEl(eEBMLMaxSize, 8),
		strEl(eDocType, "matroska"), uintEl(eDocTypeVer, 4), uintEl(eDocTypeRead, 2)))
	var segHdr []byte
	if o.UnknownSegmentSize {
		segHdr = cat(idBytes(eSegment), unknownSize)
	} else {
		segHdr = cat(idBytes(eSegment), sizeBytes(int64(body.Len()), 8))
	}
	segStart := int64(len(header) + len(segHdr))
	out.Bytes = cat(header, segHdr, body.Bytes())
	out.ClusterOffsets = out.ClusterOffsets[:0]
	for _, p := range clusterPos {
		out.ClusterOffsets = append(out.ClusterOffsets, segStart+p)
	}
	return out
}

func voidEl(total int) []byte {
	if total < 2 {
		total = 2
	}
	payload := total - 2 // ID de 1 byte + tamaño de 1 byte
	if payload > 126 {
		payload = total - 9 // tamaño de 8 bytes
		return cat([]byte{byte(eVoid)}, sizeBytes(int64(payload), 8), make([]byte, payload))
	}
	return cat([]byte{byte(eVoid)}, sizeBytes(int64(payload), 1), make([]byte, payload))
}
