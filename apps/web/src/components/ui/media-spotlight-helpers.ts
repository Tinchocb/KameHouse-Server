import type { SwimlaneItem } from "./swimlane"

export {
    ERAS,
    ERA_COLOR_MAP,
    ERA_DEFAULTS,
    type EraId,
} from "@/lib/config/eras"
import { MEDIA_ID_TO_ERA, KNOWN_MOVIE_TMDB_IDS, type EraId } from "@/lib/config/eras"
import { buildVideoThumbnailUrl } from "@/lib/helpers/images"

// Helper to classify media into an era based on title matching
function getEraFromTitle(title: string): EraId | null {
    if (!title) return null
    const t = title.toLowerCase().trim()

    // 1. Check Daima
    if (t.includes("daima") || t.includes("dbdaima")) return "dbdaima"

    // 2. Check Kai
    if (
        (t.includes("kai") && (t.includes("dragon") || t.includes("db") || t.includes("bola"))) ||
        t.includes("dbkai") ||
        t.includes("dbzkai") ||
        t.includes("dragon ball z kai") ||
        t.includes("dragon ball kai")
    ) {
        return "dbkai"
    }

    // 3. Check GT
    if (
        (t.includes("gt") && (t.includes("dragon") || t.includes("db") || t.includes("bola"))) ||
        t.includes("dbgt") ||
        t.includes("dragon ball gt") ||
        t.includes("100 años después") ||
        t.includes("100 anos despues") ||
        (t.includes("baby") && (t.includes("goku") || t.includes("saiyajin") || t.includes("dragon"))) ||
        (t.includes("super 17") && (t.includes("goku") || t.includes("dragon") || t.includes("db")))
    ) {
        return "dbgt"
    }

    // 4. Check Super (Movies & Series)
    const hasDbContext = t.includes("dragon") || t.includes("db") || t.includes("bola") || t.includes("goku")
    if (
        (t.includes("super") && hasDbContext) ||
        t.includes("dbs") ||
        t.includes("dragon ball super") ||
        (t.includes("super hero") && hasDbContext) ||
        (t.includes("broly") && (t.includes("super") || hasDbContext)) ||
        (t.includes("batalla de los dioses") && (hasDbContext || t.includes("dioses"))) ||
        (t.includes("resurrección de f") || t.includes("resurreccion de f"))
    ) {
        // Exclude DBZ Broly movies
        if (
            t.includes("estalla el duelo") ||
            t.includes("segunda venida") ||
            t.includes("combate definitivo") ||
            t.includes("regreso de broly") ||
            t.includes("poder invencible")
        ) {
            return "dbz"
        }
        return "dbs"
    }

    // 5. Check Dragon Ball Z (Series, Movies, OVAs)
    if (
        (t.includes(" z") && hasDbContext) ||
        t.includes("dbz") ||
        t.includes("dragon ball z") ||
        t.includes("garlick") ||
        t.includes("devuélvanme a mi gohan") ||
        t.includes("devuelvanme a mi gohan") ||
        t.includes("más fuerte del mundo") ||
        t.includes("mas fuerte del mundo") ||
        t.includes("súper batalla") ||
        t.includes("super batalla") ||
        t.includes("súper guerrero son goku") ||
        t.includes("super guerrero son goku") ||
        t.includes("mejores rivales") ||
        t.includes("los rivales más poderosos") ||
        t.includes("los guerreros más poderosos") ||
        t.includes("fuerza ilimitada") ||
        t.includes("tres grandes super") ||
        t.includes("estalla el duelo") ||
        t.includes("guerreros de plata") ||
        t.includes("la galaxia corre peligro") ||
        t.includes("el regreso de broly") ||
        t.includes("el regreso del guerrero legendario") ||
        t.includes("combate definitivo") ||
        t.includes("el combate final") ||
        t.includes("la fusión de goku") ||
        t.includes("la fusion de goku") ||
        t.includes("el ataque del dragón") ||
        t.includes("el ataque del dragon") ||
        t.includes("poder invencible") ||
        t.includes("padre de goku") ||
        t.includes("bardock") ||
        t.includes("dos guerreros del futuro") ||
        t.includes("gohan y trunks") ||
        t.includes("plan para erradicar a los saiyajin") ||
        t.includes("plan para erradicar los saiyajin") ||
        t.includes("goku y sus amigos regresan")
    ) {
        return "dbz"
    }

    // 6. Check Original Dragon Ball
    if (
        t.includes("dragon ball") ||
        t.includes("dragonball") ||
        t.includes("bola de drag") ||
        t.includes("la leyenda de shenlong") ||
        t.includes("la leyenda de shen long") ||
        t.includes("la princesa durmiente") ||
        t.includes("aventura mística") ||
        t.includes("aventura mistica") ||
        t.includes("camino hacia el poder") ||
        t.includes("camino al poder")
    ) {
        return "db"
    }

    return null
}

const MAX_ERA_CACHE_SIZE = 500
const eraCache = new Map<string, EraId | null>()

function setInEraCache(id: string, era: EraId | null) {
    if (eraCache.size >= MAX_ERA_CACHE_SIZE) {
        const firstKey = eraCache.keys().next().value
        if (firstKey) eraCache.delete(firstKey)
    }
    eraCache.set(id, era)
}

export function getEraFromItem(item: SwimlaneItem): EraId | null {
    const cached = eraCache.get(item.id)
    if (cached !== undefined) return cached

    // 1. Try mapping by tmdbId if provided
    if (item.tmdbId) {
        const rawId = item.tmdbId >= 1000000 ? item.tmdbId - 1000000 : item.tmdbId
        if (item.tmdbId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[item.tmdbId]
            setInEraCache(item.id, era)
            return era
        }
        if (rawId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[rawId]
            setInEraCache(item.id, era)
            return era
        }
    }

    // 2. Try mapping by mediaId if provided
    if (item.mediaId) {
        const rawId = item.mediaId >= 1000000 ? item.mediaId - 1000000 : item.mediaId
        if (item.mediaId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[item.mediaId]
            setInEraCache(item.id, era)
            return era
        }
        if (rawId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[rawId]
            setInEraCache(item.id, era)
            return era
        }
    }

    // 3. Try mapping by ID embedded in string
    const mediaId = Number(item.id.replace(/^(media|cw)-/, ""))
    if (!isNaN(mediaId)) {
        const rawId = mediaId >= 1000000 ? mediaId - 1000000 : mediaId
        if (mediaId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[mediaId]
            setInEraCache(item.id, era)
            return era
        }
        if (rawId in MEDIA_ID_TO_ERA) {
            const era = MEDIA_ID_TO_ERA[rawId]
            setInEraCache(item.id, era)
            return era
        }
    }

    // 4. Fallback to title matching
    const era = getEraFromTitle(item.title)
    setInEraCache(item.id, era)
    return era
}

export function isMovieItem(item: SwimlaneItem): boolean {
    if (!item) return false

    // 1. Explicit badge check
    if (item.badge === "MOVIE" || item.badge === "SPECIAL" || item.badge === "OVA") {
        return true
    }

    // 2. Known Movie TMDB ID check (offset normalizado)
    const rawTmdbId = item.tmdbId ? (item.tmdbId >= 1_000_000 ? item.tmdbId - 1_000_000 : item.tmdbId) : undefined
    if (rawTmdbId && KNOWN_MOVIE_TMDB_IDS.has(rawTmdbId)) return true

    const rawMediaId = item.mediaId ? (item.mediaId >= 1_000_000 ? item.mediaId - 1_000_000 : item.mediaId) : undefined
    if (rawMediaId && KNOWN_MOVIE_TMDB_IDS.has(rawMediaId)) return true

    const parsedId = Number(item.id.replace(/^(media|cw)-/, ""))
    if (!isNaN(parsedId)) {
        const rawParsed = parsedId >= 1_000_000 ? parsedId - 1_000_000 : parsedId
        if (KNOWN_MOVIE_TMDB_IDS.has(rawParsed)) return true
    }

    // 3. Title keywords
    const titleLower = item.title.toLowerCase()
    if (
        titleLower.includes("pelicula") ||
        titleLower.includes("película") ||
        titleLower.includes("movie") ||
        titleLower.includes("especial") ||
        titleLower.includes("special") ||
        titleLower.includes("ova") ||
        titleLower.includes("roadshow") ||
        titleLower.includes("cinerama")
    ) {
        return true
    }

    return false
}

/**
 * Core thumbnail resolver for any episode range (saga or sub-saga).
 * Priority: TMDB still > local video frame > fallback.
 */
export function resolveRangeDynamicThumbnail({
    startEp,
    endEp,
    iconicEp,
    episodes,
    serverBase,
    fallbackUrl,
}: {
    startEp: number
    endEp: number
    iconicEp?: number
    episodes?: import("@/api/generated/types").Anime_Episode[] | null
    serverBase?: string
    fallbackUrl?: string
}): string | null {
    if (!episodes || episodes.length === 0) {
        return fallbackUrl || null
    }

    const base = serverBase || ""
    const effectiveIconicEp = iconicEp ?? Math.round((startEp + endEp) / 2)

    // Filter candidate episodes that fall within the range
    const rangeEps = episodes.filter(
        ep => ep.episodeNumber >= startEp && ep.episodeNumber <= endEp
    )

    if (rangeEps.length === 0) {
        return fallbackUrl || null
    }

    // Prioritized order:
    // 1. Explicit iconic / climax episode
    // 2. Ending episode of the range
    // 3. Any other episode in the range
    const priorityEps = [
        rangeEps.find(ep => ep.episodeNumber === effectiveIconicEp),
        rangeEps.find(ep => ep.episodeNumber === endEp),
        ...rangeEps
    ].filter(Boolean) as import("@/api/generated/types").Anime_Episode[]

    // A. Official TMDB / provider episode broadcast still
    for (const ep of priorityEps) {
        if (ep.episodeMetadata?.image) {
            return ep.episodeMetadata.image
        }
    }

    // B. Local video file frame extracted via video-thumbnail endpoint
    for (const ep of priorityEps) {
        if (ep.localFile?.path) {
            return buildVideoThumbnailUrl(ep.localFile, { base })
        }
    }

    return fallbackUrl || null
}

/**
 * Resolves a dynamic thumbnail for a saga from the actual episodes of the series in the library.
 * Prioritizes the iconic/climax episode's TMDB broadcast still or local video file frame,
 * completely avoiding hardcoded static image assets.
 */
export function resolveSagaDynamicThumbnail({
    saga,
    episodes,
    serverBase,
    fallbackUrl,
}: {
    saga: import("@/lib/config/dragonball_sagas").SagaDefinition
    episodes?: import("@/api/generated/types").Anime_Episode[] | null
    serverBase?: string
    fallbackUrl?: string
}): string | null {
    return resolveRangeDynamicThumbnail({
        startEp: saga.startEp,
        endEp: saga.endEp,
        iconicEp: saga.iconicEp,
        episodes,
        serverBase,
        fallbackUrl,
    })
}

