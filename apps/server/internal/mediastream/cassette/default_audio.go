package cassette

import (
	"fmt"
	"strings"
)

// PreferAudioTrack reescribe la lista maestra para que la pista de audio `audioIndex` sea la que
// arranca (DEFAULT=YES) en vez de la que el archivo marca por defecto. Los reproductores HLS
// nativos (Tizen, Safari) no exponen un selector de pista: eligen la DEFAULT de la lista, así que
// el cliente pide ?audio=N en el master para reproducir un doblaje que no es el de fábrica.
//
// Si ninguna pista de audio tiene ese índice, la lista queda igual.
func PreferAudioTrack(master string, audioIndex int) string {
	const mediaPrefix = "#EXT-X-MEDIA:TYPE=AUDIO,"
	target := fmt.Sprintf(`URI="./audio/%d/index.m3u8`, audioIndex)

	lines := strings.Split(master, "\n")
	found := false
	for _, l := range lines {
		if strings.HasPrefix(l, mediaPrefix) && strings.Contains(l, target) {
			found = true
			break
		}
	}
	if !found {
		return master
	}

	for i, l := range lines {
		if !strings.HasPrefix(l, mediaPrefix) {
			continue
		}
		l = strings.Replace(l, "DEFAULT=YES,", "", 1)
		l = strings.Replace(l, "AUTOSELECT=YES,", "", 1)
		if strings.Contains(l, target) {
			l = strings.Replace(l, mediaPrefix, mediaPrefix+"DEFAULT=YES,AUTOSELECT=YES,", 1)
		}
		lines[i] = l
	}
	return strings.Join(lines, "\n")
}
