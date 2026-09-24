import type { Models_LibraryMedia } from "@/api/generated/types"
import { isTmdbId } from "@/lib/helpers/type-guards"
import { EraTab } from "../-MovieCard"
import { MEDIA_ID_TO_ERA, type EraId } from "@/lib/config/eras"

export type SortOption = "year_asc" | "year_desc" | "alpha_asc" | "alpha_desc" | "rating_desc"

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: "alpha_asc", label: "Alfabético (A - Z)" },
    { value: "alpha_desc", label: "Alfabético (Z - A)" },
    { value: "year_desc", label: "Año: Recientes" },
    { value: "year_asc", label: "Año: Antiguos" },
    { value: "rating_desc", label: "Mejor Valorados" },
]

/** Mapea el valor guardado en Settings → Apariencia al SortOption local.
 *  Cubre las 5 opciones del selector; cualquier legacy ("alpha", "SCORE_DESC",
 *  undefined) cae al default TITLE_ASC. */
export function mapCollectionSortToOption(value: string | undefined | null): SortOption {
    switch (value) {
        case "TITLE_ASC": return "alpha_asc"
        case "TITLE_DESC": return "alpha_desc"
        case "YEAR_ASC": return "year_asc"
        case "YEAR_DESC": return "year_desc"
        case "RATING_DESC":
        case "SCORE_DESC": return "rating_desc"
        case "alpha": return "alpha_asc"
        default: return "alpha_asc"
    }
}

export function getEntryTitle(entry?: { media?: Models_LibraryMedia | null; mediaId?: number | null } | null): string {
    if (!entry) return ""
    const spanish = entry.media?.titleSpanish?.trim()
    const english = entry.media?.titleEnglish?.trim()
    const isGenericOrEmptySpanish = !spanish ||
        spanish.toLowerCase() === "dragon ball serie" ||
        spanish.toLowerCase() === "dragon ball series" ||
        (english && spanish.toLowerCase() === english.toLowerCase())
    if (!isGenericOrEmptySpanish) {
        return spanish
    }
    const lore = getMovieLore(entry)
    if (lore?.title) {
        return lore.title
    }
    return spanish || entry.media?.titleRomaji || english || entry.media?.titleOriginal || ""
}

export function getLoreDescription(lore?: MovieLoreDefinition | null): string {
    if (!lore) return ""
    return lore.chronologyNotes || lore.specialTrivia || lore.keyEvents?.join(" ") || ""
}

export function getEntryRating(entry?: { media?: Models_LibraryMedia | null; listData?: { score?: number } | null } | null): number {
    if (!entry) return 0
    return entry.media?.score || entry.media?.rating || entry.listData?.score || 0
}

const specialsTmdbIds = new Set([39323, 39324, 38594, 47734, 15461, 1259215, 109963])
const classicTmdbIds = new Set([39144, 33499, 39145, 116776, 33513, 39148])
const zTmdbIds = new Set([28609, 15448, 39100, 39101, 39102, 24752, 15452, 39103, 39104, 15454, 34433, 39105, 44251, 39106, 39107, 39108, 177572, 120475, 1120475])
const gtTmdbIds = new Set([18095, 39149])
const superTmdbIds = new Set([126963, 303857, 503314, 610150])
const zKeywords = ["z ", " z:", "freezer", "frieza", "cooler", "androide", "android", "bojack", "janemba", "tapion", "bardock", "trunks", "broly", "slug", "turles", "dead zone", "fusion", "bio-broly", "gohan", "vegeta"]

export function getEntryEra(entry?: { media?: Models_LibraryMedia | null; mediaId?: number | null } | null): EraTab {
    if (!entry) return "Especiales y OVAs"
    const media = entry.media
    const tmdbId = media?.tmdbId || (entry.mediaId && isTmdbId(entry.mediaId) ? entry.mediaId : 0) || 0
    const rawTmdbId = tmdbId >= 1000000 ? tmdbId - 1000000 : tmdbId

    if (rawTmdbId > 0) {
        if (specialsTmdbIds.has(rawTmdbId)) return "Especiales y OVAs"
        if (classicTmdbIds.has(rawTmdbId)) return "Dragon Ball"
        if (zTmdbIds.has(rawTmdbId)) return "Dragon Ball Z"
        if (gtTmdbIds.has(rawTmdbId)) return "Dragon Ball GT"
        if (superTmdbIds.has(rawTmdbId)) return "Dragon Ball Super"
    }

    if (!media) return "Especiales y OVAs"

    const allTitles = [media.titleRomaji, media.titleEnglish, media.titleOriginal, media.titleSpanish]
        .filter(Boolean).join(" ").toLowerCase()
    if (!allTitles.includes("dragon ball")) return "Especiales y OVAs"
    if (allTitles.includes("special") || allTitles.includes("especial") || allTitles.includes("ova") || media.format === "SPECIAL" || media.format === "OVA") return "Especiales y OVAs"
    const hasSuper = allTitles.includes("dragon ball super") || 
        allTitles.includes("db super") || 
        allTitles.includes("dbs") ||
        (allTitles.includes("dragon ball") && (allTitles.includes("super hero") || allTitles.includes("superhero") || allTitles.includes("super-hero")))
    if (hasSuper) return "Dragon Ball Super"
    if (allTitles.includes(" gt") || allTitles.includes("gt ")) return "Dragon Ball GT"
    if (zKeywords.some(k => allTitles.includes(k))) return "Dragon Ball Z"
    return "Dragon Ball"
}

/**
 * Clasifica una película en las 6 eras canónicas de Home (EraId) para
 * reutilizar SpotlightEraNav directamente.
 * 1. MEDIA_ID_TO_ERA (fuente canónica, cubre TMDB + offset 1M)
 * 2. lore.era (Dragon Ball / Z / GT / Super)
 * 3. Fallback a getEntryEra legacy mapeado (Especiales → dbz mayoritario)
 */
export function getEntryEraId(entry?: { media?: Models_LibraryMedia | null; mediaId?: number | null } | null): EraId {
    if (!entry) return "dbz"
    const media = entry.media
    const tmdbId = media?.tmdbId || (entry.mediaId && isTmdbId(entry.mediaId) ? entry.mediaId : 0) || 0
    const rawTmdbId = tmdbId >= 1000000 ? tmdbId - 1000000 : tmdbId
    if (tmdbId > 0 && (MEDIA_ID_TO_ERA as Record<number, EraId>)[tmdbId]) {
        return (MEDIA_ID_TO_ERA as Record<number, EraId>)[tmdbId]
    }
    if (rawTmdbId > 0 && (MEDIA_ID_TO_ERA as Record<number, EraId>)[rawTmdbId]) {
        return (MEDIA_ID_TO_ERA as Record<number, EraId>)[rawTmdbId]
    }
    if (entry.mediaId && (MEDIA_ID_TO_ERA as Record<number, EraId>)[entry.mediaId]) {
        return (MEDIA_ID_TO_ERA as Record<number, EraId>)[entry.mediaId]
    }

    const lore = getMovieLore(entry)
    const loreEra = lore?.era?.toLowerCase() || ""
    if (loreEra.includes("super")) return "dbs"
    if (loreEra.includes("gt")) return "dbgt"
    if (loreEra.includes("dragon ball z") || loreEra === "z") return "dbz"
    if (loreEra.includes("dragon ball")) return "db"

    const legacy = getEntryEra(entry)
    switch (legacy) {
        case "Dragon Ball": return "db"
        case "Dragon Ball Z": return "dbz"
        case "Dragon Ball GT": return "dbgt"
        case "Dragon Ball Super": return "dbs"
        default: return "dbz"
    }
}

export function getReleaseDateTimestamp(entry?: { media?: Models_LibraryMedia | null; mediaId?: number | null } | null): number {
    if (!entry) return 0
    const media = entry.media
    if (!media) return 0
    if (media.startDate) {
        const parsed = Date.parse(media.startDate)
        if (!isNaN(parsed) && parsed > 0) {
            return parsed
        }
    }
    if (media.year) {
        return new Date(media.year, 0, 1).getTime()
    }
    return 0
}

import { TMDB_TO_LORE_MOVIE_MAP, DRAGON_BALL_MOVIES_LORE, type MovieLoreDefinition } from "@/lib/config/dragonball_movies_lore"

export function getMovieLore(entry?: { media?: Models_LibraryMedia | null; mediaId?: number | null } | null, opts?: { skipTmdbMap?: boolean }): MovieLoreDefinition | null {
    if (!entry) return null
    const tmdbId = entry.media?.tmdbId || (entry.mediaId && isTmdbId(entry.mediaId) ? entry.mediaId : 0) || 0
    const rawTmdbId = tmdbId >= 1000000 ? tmdbId - 1000000 : tmdbId

    // 1. Match direct by TMDB ID (omitible: el mapa TMDB→lore puede estar
    //    desfasado frente al scanner del servidor; por texto es inequívoco)
    if (!opts?.skipTmdbMap && rawTmdbId > 0 && TMDB_TO_LORE_MOVIE_MAP[rawTmdbId]) {
        const loreId = TMDB_TO_LORE_MOVIE_MAP[rawTmdbId]
        if (DRAGON_BALL_MOVIES_LORE[loreId]) return DRAGON_BALL_MOVIES_LORE[loreId]
    }

    const textToSearch = [
        entry.media?.titleSpanish,
        entry.media?.titleRomaji,
        entry.media?.titleEnglish,
        entry.media?.description,
    ].filter(Boolean).join(" ").toLowerCase()

    // 2. Match by exact lore title
    for (const lore of Object.values(DRAGON_BALL_MOVIES_LORE)) {
        if (textToSearch.includes(lore.title.toLowerCase())) {
            return lore
        }
    }

    // 3. Match by distinctive keywords / antagonists
    if (textToSearch.includes("wheelo") || textToSearch.includes("kochin") || textToSearch.includes("uiro") || textToSearch.includes("fuerte de este mundo") || textToSearch.includes("world's strongest")) return DRAGON_BALL_MOVIES_LORE.m6
    if (textToSearch.includes("turles") || textToSearch.includes("árbol sagrado") || textToSearch.includes("tree of might") || textToSearch.includes("super batalla")) return DRAGON_BALL_MOVIES_LORE.m7
    if (textToSearch.includes("garlic") || textToSearch.includes("dead zone") || textToSearch.includes("devuélvanme a mi gohan")) return DRAGON_BALL_MOVIES_LORE.m5
    if (textToSearch.includes("slug") || textToSearch.includes("super saiyajin falso")) return DRAGON_BALL_MOVIES_LORE.m8
    if (textToSearch.includes("metal cooler") || textToSearch.includes("gete") || textToSearch.includes("guerreros de plata")) return DRAGON_BALL_MOVIES_LORE.m10
    if (textToSearch.includes("cooler") || textToSearch.includes("rivales más poderosos")) return DRAGON_BALL_MOVIES_LORE.m9
    if (textToSearch.includes("androide 13") || textToSearch.includes("android 13") || textToSearch.includes("tres super saiyajin")) return DRAGON_BALL_MOVIES_LORE.m11
    if (textToSearch.includes("bio-broly") || textToSearch.includes("combate definitivo")) return DRAGON_BALL_MOVIES_LORE.m15
    if (textToSearch.includes("regreso del guerrero") || (textToSearch.includes("broly") && textToSearch.includes("regreso"))) return DRAGON_BALL_MOVIES_LORE.m14
    if (textToSearch.includes("poder invencible") || (textToSearch.includes("broly") && !textToSearch.includes("super") && !textToSearch.includes("superhero"))) return DRAGON_BALL_MOVIES_LORE.m12
    if (textToSearch.includes("bojack") || textToSearch.includes("boujack") || textToSearch.includes("galaxia corre peligro")) return DRAGON_BALL_MOVIES_LORE.m13
    if (textToSearch.includes("janemba") || textToSearch.includes("gogeta") || textToSearch.includes("renacer de la fusión")) return DRAGON_BALL_MOVIES_LORE.m16
    if (textToSearch.includes("tapion") || textToSearch.includes("hildegarn") || textToSearch.includes("ataque del dragón")) return DRAGON_BALL_MOVIES_LORE.m17
    if (textToSearch.includes("beerus") || textToSearch.includes("bills") || textToSearch.includes("batalla de los dioses")) return DRAGON_BALL_MOVIES_LORE.m18
    if (textToSearch.includes("resurrección de freezer") || textToSearch.includes("resurrection 'f'")) return DRAGON_BALL_MOVIES_LORE.m19
    if (textToSearch.includes("super hero") || textToSearch.includes("superhero") || textToSearch.includes("gamma") || textToSearch.includes("cell max")) return DRAGON_BALL_MOVIES_LORE.m21
    if (textToSearch.includes("super") && textToSearch.includes("broly")) return DRAGON_BALL_MOVIES_LORE.m20
    if (textToSearch.includes("bardock") || textToSearch.includes("padre de goku")) return DRAGON_BALL_MOVIES_LORE.sp1
    if (textToSearch.includes("trunks del futuro") || textToSearch.includes("historia de trunks")) return DRAGON_BALL_MOVIES_LORE.sp2
    if (textToSearch.includes("100 años") || textToSearch.includes("goku jr")) return DRAGON_BALL_MOVIES_LORE.sp3
    if (textToSearch.includes("shenlong") || textToSearch.includes("gurumes") || textToSearch.includes("blood rubies")) return DRAGON_BALL_MOVIES_LORE.m1
    if (textToSearch.includes("lucifer") || textToSearch.includes("castillo del mal") || textToSearch.includes("sleeping princess")) return DRAGON_BALL_MOVIES_LORE.m2
    if (textToSearch.includes("mifan") || textToSearch.includes("aventura mística")) return DRAGON_BALL_MOVIES_LORE.m3
    if (textToSearch.includes("camino hacia el poder") || textToSearch.includes("path to power")) return DRAGON_BALL_MOVIES_LORE.m4
    if (textToSearch.includes("bomberos") || textToSearch.includes("fire brigade") || textToSearch.includes("shoboutai") || textToSearch.includes("shouboutai")) return DRAGON_BALL_MOVIES_LORE.sp4
    if (textToSearch.includes("seguridad vial") || textToSearch.includes("traffic safety") || textToSearch.includes("koutsuu anzen")) return DRAGON_BALL_MOVIES_LORE.sp5
    if (textToSearch.includes("todos reunidos") || textToSearch.includes("mundo de goku") || textToSearch.includes("goku world") || textToSearch.includes("atsumare")) return DRAGON_BALL_MOVIES_LORE.sp6
    if (textToSearch.includes("te lo mostramos todo") || textToSearch.includes("olvida el año") || textToSearch.includes("olvida el ano") || textToSearch.includes("year-end show")) return DRAGON_BALL_MOVIES_LORE.sp7
    if (textToSearch.includes("esfera del pánico") || textToSearch.includes("esfera del panico") || textToSearch.includes("kyutai panic")) return DRAGON_BALL_MOVIES_LORE.sp8
    if (textToSearch.includes("toriko") || textToSearch.includes("dream 9") || textToSearch.includes("super colaboración") || textToSearch.includes("super colaboracion")) return DRAGON_BALL_MOVIES_LORE.sp9

    return null
}

/**
 * Genera una permutación aleatoria sin repetición de índices [0 ... length - 1]
 * utilizando el algoritmo Fisher-Yates (Knuth shuffle).
 * Si se especifica `excludeFirst`, se garantiza que el primer elemento
 * no sea igual a ese valor (siempre que length > 1).
 */
export function createShuffledIndices(length: number, excludeFirst?: number): number[] {
    if (length <= 0) return []
    const arr = Array.from({ length }, (_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (excludeFirst !== undefined && arr.length > 1 && arr[0] === excludeFirst) {
        const swapIdx = 1 + Math.floor(Math.random() * (arr.length - 1));
        [arr[0], arr[swapIdx]] = [arr[swapIdx], arr[0]];
    }
    return arr
}
