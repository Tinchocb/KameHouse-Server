import type { Anime_LocalFile, AudioStreamInfo } from "@/api/generated/types"
import { languageFamily } from "@/components/video/track-selection"

/** Resumen de doblajes, subtítulos y calidad de los archivos locales de una serie. */
interface SeriesAudioSummary {
    /** Idiomas de audio, con el original (japonés) primero: ["Japonés", "Latino"]. */
    dubs: string[]
    /** Idiomas de subtítulos: ["Español", "Inglés"]. */
    subs: string[]
    /** Calidad más alta de la biblioteca ("1080p", "720p"…), o null si no se conoce. */
    quality: string | null
}

const LANGUAGE_NAMES: Record<string, string> = {
    jpn: "Japonés",
    eng: "Inglés",
    por: "Portugués",
    fra: "Francés",
    deu: "Alemán",
    ita: "Italiano",
    rus: "Ruso",
    zho: "Chino",
    kor: "Coreano",
}

// Pistas sin código de idioma: el idioma sale del nombre de la pista (mismas reglas que el reproductor).
const TITLE_HINTS: Array<[RegExp, string]> = [
    [/espa[nñ]ol|spanish|latino|castellano|latam/i, "spa"],
    [/english|ingl[eé]s/i, "eng"],
    [/japon|japanese/i, "jpn"],
]

const LATAM_REGIONS = new Set(["la", "lat", "419", "mx", "ar", "co", "cl", "pe", "ve", "uy"])

function streamFamily(stream: AudioStreamInfo): string {
    const family = languageFamily(stream.language)
    if (family) return family
    return TITLE_HINTS.find(([re]) => re.test(stream.title ?? ""))?.[1] ?? ""
}

/** Variante del español: "Latino" o "Castellano" si el archivo lo dice; si no, "Español". */
function spanishLabel(stream: AudioStreamInfo): string {
    const parts = (stream.language ?? "").toLowerCase().split(/[-_]/)
    const region = parts[1] ?? ""
    const title = (stream.title ?? "").toLowerCase()
    if (parts[0] === "lat" || LATAM_REGIONS.has(region) || /latino|latam|mexic/.test(title)) return "Latino"
    if (region === "es" || /castellano|espa[nñ]a|spain|iberi/.test(title)) return "Castellano"
    return "Español"
}

function languageLabel(stream: AudioStreamInfo): string | null {
    const family = streamFamily(stream)
    if (!family) return null
    if (family === "spa") return spanishLabel(stream)
    return LANGUAGE_NAMES[family] ?? family.toUpperCase()
}

function qualityLabel(width: number): string | null {
    if (width >= 3840) return "4K"
    if (width >= 1920) return "1080p"
    if (width >= 1280) return "720p"
    return width > 0 ? "SD" : null
}

/** Junta doblajes, subtítulos y calidad de todos los archivos de la serie. Sin datos, devuelve listas vacías. */
export function summarizeSeriesAudio(files: Anime_LocalFile[] | null | undefined): SeriesAudioSummary {
    const dubs = new Set<string>()
    const subs = new Set<string>()
    let maxWidth = 0
    for (const file of files ?? []) {
        const info = file.technicalInfo
        if (!info) continue
        for (const stream of info.audioStreams ?? []) {
            const label = languageLabel(stream)
            if (label) dubs.add(label)
        }
        for (const stream of info.subtitleStreams ?? []) {
            const label = languageLabel(stream)
            if (label) subs.add(label)
        }
        maxWidth = Math.max(maxWidth, info.videoStream?.width ?? 0)
    }
    // El japonés es el audio original: va primero.
    const dubList = [...dubs].sort((a, b) => Number(b === "Japonés") - Number(a === "Japonés"))
    return { dubs: dubList, subs: [...subs], quality: qualityLabel(maxWidth) }
}
