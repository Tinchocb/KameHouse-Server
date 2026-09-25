// libass (the engine behind JASSUB) only parses ASS/SSA. Text subtitles extracted
// from the container with `-c:s copy` arrive as raw SubRip (.srt) or WebVTT (.vtt),
// which libass silently fails to render. We convert those to a minimal ASS document
// so JASSUB can display them. ASS/SSA content is passed through untouched.

const ASS_HEADER = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2.6,1.2,2,60,60,54,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

// Matches a SubRip/WebVTT timing line, tolerating both "," and "." as the ms separator,
// optional hours (WebVTT MM:SS.mmm), and optional WebVTT cue settings trailing the end timestamp.
const TIMING_RE = /(?:(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3}))\s*-->\s*(?:(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3}))/

// assTime formats an h/m/s/ms tuple as ASS "H:MM:SS.cc" (centisecond precision).
function assTime(h: string | undefined, m: string, s: string, ms: string): string {
    const hours = h ? parseInt(h, 10) : 0
    const cs = Math.floor(parseInt(ms.padEnd(3, "0").slice(0, 3), 10) / 10)
    return `${hours}:${m}:${s}.${cs.toString().padStart(2, "0")}`
}

// escapeText turns a cue's text lines into a single ASS Dialogue text field:
// converts basic HTML styling tags to ASS overrides, strips the rest, escapes braces
// (which start an ASS override block), and joins wrapped lines with "\N".
function escapeText(lines: string[]): string {
    return lines
        .join("\n")
        .replace(/[{}]/g, "") // literal braces would open/close an override block
        .replace(/<i>/gi, "{\\i1}").replace(/<\/i>/gi, "{\\i0}")
        .replace(/<b>/gi, "{\\b1}").replace(/<\/b>/gi, "{\\b0}")
        .replace(/<u>/gi, "{\\u1}").replace(/<\/u>/gi, "{\\u0}")
        .replace(/<[^>]+>/g, "") // drop any remaining tags (font, ruby, cue spans…)
        .replace(/\r/g, "")
        .replace(/\n/g, "\\N")
        .trim()
}

// convertToAss returns an ASS document for SubRip/WebVTT input, or the content
// unchanged when it is already ASS/SSA (or an unknown codec we shouldn't touch).
export function convertToAss(content: string, codec: string | undefined): string {
    const c = (codec ?? "").toLowerCase()
    if (c === "ass" || c === "ssa") return content
    if (c !== "subrip" && c !== "srt" && c !== "vtt" && c !== "webvtt") return content

    const dialogues: string[] = []
    // Split into cue blocks on blank lines; works for both SRT and VTT.
    const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/)
    for (const block of blocks) {
        const rawLines = block.split("\n")
        let timingIdx = -1
        let match: RegExpMatchArray | null = null
        for (let i = 0; i < rawLines.length; i++) {
            const m = rawLines[i].match(TIMING_RE)
            if (m) {
                timingIdx = i
                match = m
                break
            }
        }
        if (timingIdx === -1 || !match) continue // header (WEBVTT), NOTE, numbering-only, etc.

        const start = assTime(match[1], match[2], match[3], match[4])
        const end = assTime(match[5], match[6], match[7], match[8])
        const textLines = rawLines.slice(timingIdx + 1).filter(l => l.length > 0)
        if (textLines.length === 0) continue
        const text = escapeText(textLines)
        if (text.length === 0) continue
        dialogues.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`)
    }

    return ASS_HEADER + dialogues.join("\n") + "\n"
}

// Campos de estilo que definen el tamaño visible del texto. Se escalan juntos para
// que el contorno y la sombra mantengan la proporción con la letra.
const SCALED_STYLE_FIELDS = ["fontsize", "outline", "shadow"]

// scaleAssStyles multiplica Fontsize/Outline/Shadow de cada `Style:` del documento
// ASS por `factor`. Es lo que implementa el "Tamaño de subtítulos" del reproductor:
// el prescaleFactor de JASSUB solo cambia la resolución del canvas, no el tamaño.
// Las columnas se ubican por la línea `Format:` de la sección de estilos, así que
// funciona tanto con [V4+ Styles] como con [V4 Styles] (SSA).
export function scaleAssStyles(content: string, factor: number): string {
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.001) return content

    const lines = content.split(/(\r?\n)/)
    let inStyles = false
    let fieldIdx: number[] = []

    for (let i = 0; i < lines.length; i += 2) {
        const line = lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith("[")) {
            inStyles = /^\[v4\+? styles\]$/i.test(trimmed)
            fieldIdx = []
            continue
        }
        if (!inStyles) continue

        const format = trimmed.match(/^format\s*:(.*)$/i)
        if (format) {
            const names = format[1].split(",").map(n => n.trim().toLowerCase())
            fieldIdx = SCALED_STYLE_FIELDS.map(f => names.indexOf(f)).filter(idx => idx >= 0)
            continue
        }

        const style = line.match(/^(\s*style\s*:\s*)(.*)$/i)
        if (!style || fieldIdx.length === 0) continue
        const values = style[2].split(",")
        for (const idx of fieldIdx) {
            const n = parseFloat(values[idx])
            if (!Number.isFinite(n)) continue
            values[idx] = String(Math.round(n * factor * 100) / 100)
        }
        lines[i] = style[1] + values.join(",")
    }

    return lines.join("")
}
