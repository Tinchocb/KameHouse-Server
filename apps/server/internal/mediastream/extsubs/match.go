// Package extsubs descubre subtítulos externos (.srt/.ass/.ssa/.vtt) que acompañan a
// un video por nombre, tanto en disco local como en Google Drive, y los deja en la
// caché del servidor para servirlos por el mismo endpoint /subtitles que los
// embebidos. Este archivo contiene solo la lógica pura de nombres e idiomas.
package extsubs

import (
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/text/language"
)

// IndexBase es el primer índice de pista de los subtítulos externos. Los embebidos
// usan el índice de ffprobe (0, 1, 2…), así que arrancar en 1000 evita choques con
// el `-map 0:s:N` de la extracción y deja a /subtitles distinguir ambos orígenes.
const IndexBase = 1000

// maxPerVideo acota cuántas pistas externas se exponen por video.
const maxPerVideo = 24

// Candidate es un archivo de subtítulos que coincide con un video.
type Candidate struct {
	// Name es el nombre de archivo tal como está en disco o en Drive.
	Name string
	// Ext es la extensión en minúsculas sin punto: srt, ass, ssa o vtt.
	Ext string
	// Lang es el código ISO 639-2 detectado ("spa", "eng"…); vacío si no se detectó.
	Lang string
	// Title es la etiqueta legible para el menú del reproductor.
	Title  string
	Forced bool
}

// Codec devuelve el nombre de codec que el reproductor entiende para la extensión.
func Codec(ext string) string {
	switch strings.ToLower(strings.TrimPrefix(ext, ".")) {
	case "srt":
		return "subrip"
	case "vtt":
		return "vtt"
	case "ssa":
		return "ssa"
	case "ass":
		return "ass"
	}
	return ""
}

// IsSubtitleExt indica si la extensión (con o sin punto) es de un formato soportado.
func IsSubtitleExt(ext string) bool { return Codec(ext) != "" }

// languageNames mapea nombres y alias frecuentes en nombres de archivo a ISO 639-2.
var languageNames = map[string]string{
	"spanish": "spa", "espanol": "spa", "español": "spa", "castellano": "spa", "esp": "spa", "spa": "spa",
	"latino": "spa", "lat": "spa", "latam": "spa",
	"english": "eng", "ingles": "eng", "inglés": "eng", "eng": "eng",
	"japanese": "jpn", "japones": "jpn", "japonés": "jpn", "jap": "jpn", "jpn": "jpn",
	"portuguese": "por", "portugues": "por", "português": "por", "ptbr": "por", "por": "por",
	"french": "fra", "frances": "fra", "francés": "fra", "fre": "fra", "fra": "fra",
	"german": "deu", "aleman": "deu", "alemán": "deu", "ger": "deu", "deu": "deu",
	"italian": "ita", "italiano": "ita", "ita": "ita",
	"russian": "rus", "ruso": "rus", "rus": "rus",
	"chinese": "zho", "chino": "zho", "chi": "zho", "zho": "zho",
	"korean": "kor", "coreano": "kor", "kor": "kor",
	"arabic": "ara", "arabe": "ara", "árabe": "ara", "ara": "ara",
	"dut": "nld", "nld": "nld", "cze": "ces", "ces": "ces", "gre": "ell", "ell": "ell",
	"heb": "heb", "hin": "hin", "ind": "ind", "pol": "pol", "tur": "tur", "vie": "vie",
	"tha": "tha", "swe": "swe", "nor": "nor", "dan": "dan", "fin": "fin", "hun": "hun",
	"ukr": "ukr", "rum": "ron", "ron": "ron", "bul": "bul", "hrv": "hrv", "cat": "cat",
}

// languageLabels son las etiquetas en español para el menú.
var languageLabels = map[string]string{
	"spa": "Español", "eng": "Inglés", "jpn": "Japonés", "por": "Portugués",
	"fra": "Francés", "deu": "Alemán", "ita": "Italiano", "rus": "Ruso",
	"zho": "Chino", "kor": "Coreano", "ara": "Árabe",
}

// flagTokens son marcas que no son idioma.
var flagTokens = map[string]string{
	"forced": "forced", "forzado": "forced", "forzados": "forced", "signs": "forced",
	"sdh": "sdh", "cc": "sdh", "hi": "sdh",
	"default": "default",
}

// ParseLanguageToken convierte un token de nombre de archivo en ISO 639-2.
// Acepta ISO 639-1/2, nombres en español/inglés y variantes regionales
// ("es-419", "es-MX", "pt-BR", "es_la"). Devuelve ("", false) si no es un idioma.
func ParseLanguageToken(tok string) (iso3 string, label string, ok bool) {
	t := strings.ToLower(strings.TrimSpace(tok))
	t = strings.ReplaceAll(t, "_", "-")
	if t == "" {
		return "", "", false
	}
	if v, found := languageNames[t]; found {
		return v, labelFor(v, t), true
	}
	base, region, hasRegion := strings.Cut(t, "-")
	if v, found := languageNames[base]; found && hasRegion {
		if lbl := labelFor(v, base); region != "" {
			return v, regionLabel(v, lbl, region), true
		}
	}
	// Solo ISO 639-1 (2 letras) por el parser genérico: los códigos de 3 letras
	// del estándar 639-3 chocan con etiquetas comunes ("txt", "web", "dub").
	if len(base) == 2 {
		if b, err := language.ParseBase(base); err == nil {
			code := b.ISO3()
			lbl := languageLabels[code]
			if lbl == "" {
				lbl = strings.ToUpper(code)
			}
			if hasRegion {
				lbl = regionLabel(code, lbl, region)
			}
			return code, lbl, true
		}
	}
	return "", "", false
}

func labelFor(iso3, token string) string {
	lbl := languageLabels[iso3]
	if lbl == "" {
		lbl = strings.ToUpper(iso3)
	}
	if iso3 == "spa" && (token == "latino" || token == "lat" || token == "latam") {
		return "Español (Latino)"
	}
	if iso3 == "spa" && token == "castellano" {
		return "Español (España)"
	}
	return lbl
}

func regionLabel(iso3, label, region string) string {
	switch {
	case iso3 == "spa" && (region == "419" || region == "la" || region == "mx" || region == "lat" || region == "ar" || region == "co" || region == "cl"):
		return "Español (Latino)"
	case iso3 == "spa" && region == "es":
		return "Español (España)"
	case iso3 == "por" && region == "br":
		return "Portugués (Brasil)"
	}
	return label
}

// MatchVideo devuelve, de entre los nombres dados, los que son subtítulos del video:
// mismo nombre base y una extensión soportada, con sufijos de idioma opcionales
// ("Nombre.es.srt", "Nombre.spa.forced.ass", "Nombre - Español.srt"). La lista sale
// ordenada por nombre para que los índices sean estables entre pedidos.
func MatchVideo(videoName string, names []string) []Candidate {
	base := strings.TrimSuffix(videoName, filepath.Ext(videoName))
	if base == "" {
		return nil
	}

	var out []Candidate
	for _, name := range names {
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
		if !IsSubtitleExt(ext) {
			continue
		}
		stem := strings.TrimSuffix(name, filepath.Ext(name))
		if len(stem) < len(base) || !strings.EqualFold(stem[:len(base)], base) {
			continue
		}
		rest := stem[len(base):]
		cand, ok := parseSuffix(rest)
		if !ok {
			continue
		}
		cand.Name = name
		cand.Ext = ext
		cand.Title = buildTitle(cand)
		out = append(out, cand)
	}

	sort.SliceStable(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	if len(out) > maxPerVideo {
		out = out[:maxPerVideo]
	}
	return out
}

// parseSuffix interpreta lo que queda del nombre tras el nombre base del video.
// Vacío = subtítulo sin idioma. Un punto inicial admite etiquetas libres; otros
// separadores solo se aceptan si todo el sufijo son idioma/marcas conocidas, para no
// confundir "Episodio 1.srt" con "Episodio 10.srt" ni con extras como "Nombre - Extras.srt".
func parseSuffix(rest string) (Candidate, bool) {
	var c Candidate
	if rest == "" {
		return c, true
	}
	first := rest[0]
	lenient := first == '.'
	if !lenient && first != ' ' && first != '-' && first != '_' && first != '[' && first != '(' {
		return c, false
	}

	tokens := splitTokens(rest, lenient)
	if len(tokens) == 0 {
		return c, !lenient
	}
	var extra []string
	for _, tok := range tokens {
		// Las marcas van antes que el idioma: "hi" (hearing impaired) es también hindi.
		if flag, ok := flagTokens[strings.ToLower(tok)]; ok {
			if flag == "forced" {
				c.Forced = true
			}
			continue
		}
		if iso3, label, ok := ParseLanguageToken(tok); ok && c.Lang == "" {
			c.Lang = iso3
			c.Title = label
			continue
		}
		if isNoiseToken(tok) {
			continue
		}
		if !lenient {
			return Candidate{}, false
		}
		extra = append(extra, tok)
	}
	if !lenient && c.Lang == "" {
		return Candidate{}, false
	}
	// Etiqueta libre: sin idioma detectado, o texto adicional tras el idioma.
	if len(extra) > 0 {
		if c.Title == "" {
			c.Title = strings.Join(extra, " ")
		} else {
			c.Title += " (" + strings.Join(extra, " ") + ")"
		}
	}
	return c, true
}

func buildTitle(c Candidate) string {
	title := c.Title
	if title == "" {
		title = "Subtítulos externos"
	}
	if c.Forced && !strings.Contains(strings.ToLower(title), "forz") {
		title += " (forzado)"
	}
	return title
}

// isNoiseToken: separadores o números sueltos (p. ej. el "419" de "es-419" ya cubierto
// por ParseLanguageToken, o un "2" de un segundo archivo).
func isNoiseToken(tok string) bool {
	if tok == "" {
		return true
	}
	switch strings.ToLower(tok) {
	case "sub", "subs", "subtitle", "subtitles", "srt", "ass", "ssa", "vtt":
		return true
	}
	for _, r := range tok {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// splitTokens parte el sufijo en tokens. En modo estricto separa también por
// espacios, guiones y corchetes; en modo permisivo solo por punto (más "-"/"_" internos
// se mantienen juntos para poder reconocer "es-419" o "pt_BR").
func splitTokens(rest string, lenient bool) []string {
	isSep := func(r rune) bool {
		switch r {
		case '.', ' ', '[', ']', '(', ')', ',':
			return true
		}
		if !lenient && (r == '-' || r == '_') {
			return true
		}
		return false
	}
	var toks []string
	for _, t := range strings.FieldsFunc(rest, isSep) {
		t = strings.Trim(t, "-_")
		if t != "" {
			toks = append(toks, t)
		}
	}
	// "es-419" separado por el modo estricto deja "es" y "419": ambos válidos.
	return toks
}
