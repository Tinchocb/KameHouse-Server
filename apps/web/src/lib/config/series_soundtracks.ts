import type { BackgroundMusicTrack } from "@/lib/store"
import { getServerBaseUrl } from "@/api/client/server-url"

type SeriesEraKey = "db" | "dbz" | "dbkai" | "dbgt" | "dbs" | "dbdaima"

interface SeriesSoundtrackInfo {
    id: SeriesEraKey
    name: string
    shortName: string
    color: string
    tmdbIds: number[]
    keywords: string[]
    defaultTracks: {
        title: string
        file: string
    }[]
}

export const SERIES_SOUNDTRACKS: Record<SeriesEraKey, SeriesSoundtrackInfo> = {
    db: {
        id: "db",
        name: "Dragon Ball (Original)",
        shortName: "Dragon Ball",
        color: "#F97316", // Naranja gi de Goku (= --era-db-hex)
        tmdbIds: [12609, 1033499, 1033500, 1033513, 116776, 39145, 39144, 39148],
        keywords: ["makafushigi adventure"],
        defaultTracks: [
            { title: "Makafushigi Adventure! (instrumental)", file: "/sounds/music/opening-instrumentals/db.m4a" },
        ],
    },
    dbz: {
        id: "dbz",
        name: "Dragon Ball Z",
        shortName: "Dragon Ball Z",
        color: "#FBBF24", // Dorado Super Saiyajin (= --era-dbz-hex)
        tmdbIds: [12971, 1015448, 1015449, 1015449, 1015450, 1015451, 1015452, 1015453, 1015454, 1015455, 1015456, 1015457, 1015458, 1012704, 1015459, 1015460, 28609, 39100, 39101, 39102, 24752, 39103, 39104, 34433, 39105, 44251, 39106, 39107, 39108, 126963, 303857, 39323, 39324, 38594, 120475, 55127],
        keywords: ["cha la head cha la"],
        defaultTracks: [
            { title: "Cha-La Head-Cha-La (instrumental)", file: "/sounds/music/opening-instrumentals/dbz.m4a" },
        ],
    },
    dbkai: {
        id: "dbkai",
        name: "Dragon Ball Kai",
        shortName: "DBZ Kai",
        color: "#10B981", // Verde Esmeralda remaster (= --era-dbkai-hex)
        tmdbIds: [61709, 1061709, 60572, 1060572, 6033, 20635],
        keywords: ["dragon soul"],
        defaultTracks: [
            { title: "Dragon Soul (instrumental)", file: "/sounds/music/opening-instrumentals/dbkai.m4a" },
        ],
    },
    dbgt: {
        id: "dbgt",
        name: "Dragon Ball GT",
        shortName: "Dragon Ball GT",
        color: "#F43F5E", // Carmesí Super Saiyajin 4 (= --era-dbgt-hex)
        tmdbIds: [12697, 1012697, 1039149, 18095],
        keywords: ["dan dan kokoro"],
        defaultTracks: [
            { title: "Dan Dan Kokoro Hikareteku (instrumental)", file: "/sounds/music/opening-instrumentals/dbgt.m4a" },
        ],
    },
    dbs: {
        id: "dbs",
        name: "Dragon Ball Super",
        shortName: "Dragon Ball Super",
        color: "#3B82F6", // Azul Super Saiyajin Blue (= --era-dbs-hex)
        tmdbIds: [62715, 1062715, 503314, 1503314, 610150, 1610150],
        keywords: ["chouzetsu", "chōzetsu"],
        defaultTracks: [
            { title: "Chōzetsu☆Dynamic! (instrumental)", file: "/sounds/music/opening-instrumentals/dbs.m4a" },
        ],
    },
    dbdaima: {
        id: "dbdaima",
        name: "Dragon Ball Daima",
        shortName: "Dragon Ball Daima",
        color: "#A855F7", // Violeta Reino Demoníaco (= --era-daima-hex)
        tmdbIds: [236994, 1236994],
        keywords: ["jaka jaan", "jaka☆jaan"],
        defaultTracks: [
            { title: "Jaka Jaan (instrumental)", file: "/sounds/music/opening-instrumentals/dbdaima.m4a" },
        ],
    },
}

/**
 * Normaliza un identificador de serie, TMDB ID o string de Era a una clave de serie canónica.
 */
export function getSeriesEraKey(seriesIdOrEra: string | number | null | undefined): SeriesEraKey | null {
    if (!seriesIdOrEra) return null

    const str = String(seriesIdOrEra).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    const num = Number(seriesIdOrEra)

    // Check direct era keys
    if (str === "db" || str === "dragonball") return "db"
    if (str === "dbz" || str === "dragonballz") return "dbz"
    if (str === "dbkai" || str === "kai") return "dbkai"
    if (str === "dbgt" || str === "gt" || str === "dragonballgt") return "dbgt"
    if (str === "dbs" || str === "super" || str === "dragonballsuper") return "dbs"
    if (str === "dbdaima" || str === "daima" || str === "dragonballdaima") return "dbdaima"

    // Check TMDB ID match
    if (!isNaN(num)) {
        for (const [key, info] of Object.entries(SERIES_SOUNDTRACKS) as [SeriesEraKey, SeriesSoundtrackInfo][]) {
            if (info.tmdbIds.includes(num)) {
                return key
            }
        }
    }

    // Title / substring matching
    if (/\b(?:dbdaima|daima)\b/.test(str)) return "dbdaima"
    if (/\b(?:dbs|dragon ball super)\b/.test(str)) return "dbs"
    if (/\b(?:dbgt|dragon ball gt)\b/.test(str)) return "dbgt"
    if (/\b(?:dbkai|kai)\b/.test(str)) return "dbkai"
    if (/\b(?:dbz|dragon ball z)\b/.test(str)) return "dbz"
    if (/\b(?:db|dragon ball)\b/.test(str)) return "db"

    return null
}

interface ResolvedSoundtrackTrack {
    title: string
    url: string
    seriesKey: SeriesEraKey
    isLocal: boolean
}

// Una pista local debe identificar el opening y su versión sin voz.
// El nombre es una convención de catálogo; no es un análisis acústico del archivo.
const INSTRUMENTAL_VERSION = /\b(?:instrumental|karaoke|off[ -]?vocal|sin voz)\b/i

function isSeriesInstrumental(track: BackgroundMusicTrack, eraKey: SeriesEraKey): boolean {
    const text = `${track.name} ${track.file}`.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
    if (!INSTRUMENTAL_VERSION.test(text)) return false
    const trackEra = getSeriesEraKey(text)
    if (trackEra && trackEra !== eraKey) return false
    return SERIES_SOUNDTRACKS[eraKey].keywords.some(keyword => text.includes(keyword))
}

/**
 * Resuelve la lista de reproducción para una serie específica, priorizando pistas
 * escaneadas localmente por el usuario que contengan palabras clave de la serie.
 */
export function resolveSeriesSoundtrackPlaylist(
    seriesIdOrEra: string | number | null | undefined,
    localTracks: BackgroundMusicTrack[] = [],
    bgMusicDir?: string
): ResolvedSoundtrackTrack[] {
    const eraKey = getSeriesEraKey(seriesIdOrEra)
    if (!eraKey) return []

    const info = SERIES_SOUNDTRACKS[eraKey]
    const results: ResolvedSoundtrackTrack[] = []

    // 1. Filtrar pistas locales que coincidan con las palabras clave de la serie
    if (bgMusicDir && localTracks.length > 0) {
        const base = getServerBaseUrl() || window.location.origin
        const matchingLocal = localTracks.filter(track => isSeriesInstrumental(track, eraKey))

        for (const track of matchingLocal) {
            const params = new URLSearchParams({ dir: bgMusicDir, file: track.file })
            results.push({
                title: track.name || track.file.replace(/\.[^/.]+$/, ""),
                url: `${base}/api/v1/music/stream?${params.toString()}`,
                seriesKey: eraKey,
                isLocal: true,
            })
        }
    }

    // 2. Si no hay pistas locales específicas, usar el repertorio curado por defecto
    if (results.length === 0) {
        for (const defaultTrack of info.defaultTracks) {
            results.push({
                title: defaultTrack.title,
                url: defaultTrack.file,
                seriesKey: eraKey,
                isLocal: false,
            })
        }
    }

    return results
}
