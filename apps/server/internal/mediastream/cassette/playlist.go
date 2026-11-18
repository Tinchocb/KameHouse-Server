package cassette

import (
	"fmt"
	"kamehouse/internal/mediastream/videofile"
	"math"
	"strings"
)

// playlist generation

// querySuffix convierte los parámetros de enlace en el sufijo de una URL relativa.
func querySuffix(query string) string {
	if query == "" {
		return ""
	}
	return "?" + query
}

// GenerateMasterPlaylist builds the hls master playlist using the quality ladder
//
// query es la cadena de parámetros (sin "?") que se agrega a cada URL relativa de la lista:
// token de acceso y versión del archivo (ver Session.linkQuery).
func GenerateMasterPlaylist(info *videofile.MediaInfo, ladder []QualityLadderEntry, query string) string {
	var b strings.Builder
	b.WriteString("#EXTM3U\n")

	if info.Video == nil {
		// just list audio tracks if audio only
		writeAudioTracks(&b, info, query)
		return b.String()
	}

	// The codec advertized for transcoded variants. Original uses the source's actual codec when known.
	transcodedCodec := "avc1.640028" // h264 High L4.0 safe default

	suffix := querySuffix(query)

	for _, entry := range ladder {
		b.WriteString("#EXT-X-STREAM-INF:")

		if entry.Quality == Original || entry.Quality == Source {
			// use actual source properties
			avg, peak := EffectiveBitrate(Original, info.Video.Bitrate)
			fmt.Fprintf(&b, "AVERAGE-BANDWIDTH=%d,", avg)
			fmt.Fprintf(&b, "BANDWIDTH=%d,", peak)
			fmt.Fprintf(&b, "RESOLUTION=%dx%d,", info.Video.Width, info.Video.Height)
			codec := transcodedCodec
			if entry.OriginalCanTransmux && info.Video.MimeCodec != nil {
				codec = *info.Video.MimeCodec
			}
			fmt.Fprintf(&b, "CODECS=\"%s,mp4a.40.2\",", codec)
		} else {
			// use quality-specific bitrates capped at source
			avg, peak := EffectiveBitrate(entry.Quality, info.Video.Bitrate)
			fmt.Fprintf(&b, "AVERAGE-BANDWIDTH=%d,", avg)
			fmt.Fprintf(&b, "BANDWIDTH=%d,", peak)
			fmt.Fprintf(&b, "RESOLUTION=%dx%d,", entry.Width, entry.Height)
			fmt.Fprintf(&b, "CODECS=\"%s,mp4a.40.2\",", transcodedCodec)
		}

		b.WriteString("AUDIO=\"audio\",")
		b.WriteString("CLOSED-CAPTIONS=NONE\n")
		fmt.Fprintf(&b, "./%s/index.m3u8%s\n", entry.Quality, suffix)
	}

	writeAudioTracks(&b, info, query)
	return b.String()
}

// writeAudioTracks appends audio track entries to the playlist
func writeAudioTracks(b *strings.Builder, info *videofile.MediaInfo, query string) {
	suffix := querySuffix(query)
	for position, audio := range info.Audios {
		b.WriteString("#EXT-X-MEDIA:TYPE=AUDIO,")
		b.WriteString("GROUP-ID=\"audio\",")
		if audio.Language != nil {
			fmt.Fprintf(b, "LANGUAGE=\"%s\",", *audio.Language)
		}
		title := ""
		if audio.Title != nil {
			title = *audio.Title
		}
		// Preserve known language labels; only undefined metadata needs numbering.
		if strings.TrimSpace(title) == "" && audio.Language != nil {
			title = *audio.Language
		}
		fmt.Fprintf(b, "NAME=\"%s\",", videofile.AudioRenditionName(title, position))
		if audio.IsDefault {
			b.WriteString("DEFAULT=YES,")
		}

		ch := 2
		if audio.Channels > 0 {
			ch = int(audio.Channels)
		}
		fmt.Fprintf(b, "CHANNELS=\"%d\",", ch)
		fmt.Fprintf(b, "URI=\"./audio/%d/index.m3u8%s\"\n", audio.Index, suffix)
	}
}

// GenerateVariantPlaylist builds a variant playlist listing every segment
func GenerateVariantPlaylist(ki *KeyframeIndex, duration float64, query string) string {
	suffix := querySuffix(query)

	// Batch lock and copy timestamps to avoid locking 2N times in the loop
	ki.mu.RLock()
	keyframes := make([]float64, len(ki.Keyframes))
	copy(keyframes, ki.Keyframes)
	isDone := ki.IsDone
	ki.mu.RUnlock()

	// Un segmento por tramo entre keyframes. El último va del último keyframe al final del
	// archivo y solo se agrega con la extracción completa.
	length := len(keyframes)
	durations := make([]float64, 0, length)
	for seg := 0; seg < length-1; seg++ {
		durations = append(durations, keyframes[seg+1]-keyframes[seg])
	}
	if isDone && length > 0 {
		durations = append(durations, duration-keyframes[length-1])
	}

	var b strings.Builder
	b.WriteString("#EXTM3U\n")
	b.WriteString("#EXT-X-VERSION:6\n")
	b.WriteString("#EXT-X-PLAYLIST-TYPE:EVENT\n")
	b.WriteString("#EXT-X-START:TIME-OFFSET=0\n")
	fmt.Fprintf(&b, "#EXT-X-TARGETDURATION:%d\n", targetDuration(durations))
	b.WriteString("#EXT-X-MEDIA-SEQUENCE:0\n")
	b.WriteString("#EXT-X-INDEPENDENT-SEGMENTS\n")

	for seg, d := range durations {
		fmt.Fprintf(&b, "#EXTINF:%.6f\n", d)
		fmt.Fprintf(&b, "segment-%d.ts%s\n", seg, suffix)
	}
	if isDone && length > 0 {
		b.WriteString("#EXT-X-ENDLIST")
	}

	return b.String()
}

// minTargetDuration es el EXT-X-TARGETDURATION cuando todos los segmentos son cortos.
const minTargetDuration = 4

// targetDuration devuelve el EXT-X-TARGETDURATION de la lista: ningún EXTINF, redondeado al
// entero más cercano, puede superarlo (RFC 8216 §4.3.3.1). Los segmentos van de keyframe a
// keyframe, así que un GOP largo o un final sin keyframes (audio que sigue después del último
// cuadro) dan segmentos de más de 4 s. Con el 4 fijo, el HLS nativo de Chromium rechazaba la
// lista entera (MEDIA_ERR_SRC_NOT_SUPPORTED); hls.js lo toleraba.
func targetDuration(durations []float64) int {
	target := minTargetDuration
	for _, d := range durations {
		if r := int(math.Round(d)); r > target {
			target = r
		}
	}
	return target
}
