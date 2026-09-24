import type { Anime_LibraryCollectionEntry, Models_LibraryMedia } from "@/api/generated/types"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { IntelligentEntry } from "@/api/types/intelligence.types"
import { cleanString, getTitle, getBackdrop } from "./home.helpers"

import { DRAGON_BALL_SCANNER_SERIES, type DBFranchiseSeries } from "@/lib/config/dragonball_scanner_series"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getMovieWidescreenBackdrop, getSeriesWidescreenBackdrop } from "@/lib/config/hero-art"

export type MappableEntry = Anime_LibraryCollectionEntry | IntelligentEntry
/** Los tipos generados mienten: en runtime cualquier campo puede faltar. */
type SafeMedia = Partial<Models_LibraryMedia>
type NavigateFn = (mediaId: number) => void

const TMDB_OFFSET = 1_000_000
const MOVIE_FORMATS = new Set(["MOVIE", "SPECIAL", "OVA"])

/** Lookup O(1) de la serie canónica por tmdbId (antes `.find` por entry). */
const CANONICAL_BY_TMDB = new Map<number, DBFranchiseSeries>(
    DRAGON_BALL_SCANNER_SERIES.map(s => [s.tmdbId, s]),
)

/** Id entero positivo, o `null` para 0/NaN/negativos/no-números. */
function toPositiveInt(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
    return Math.trunc(value)
}

function normalizeToken(value: unknown): string | null {
    const token = cleanString(value).toUpperCase()
    return token === "" ? null : token
}

/** Id con el que se navega y se deduplica: `mediaId` → `tmdbId` → `id`. */
export function resolveTargetId(entry: MappableEntry, media: SafeMedia): number | null {
    return toPositiveInt(entry.mediaId) ?? toPositiveInt(media.tmdbId) ?? toPositiveInt(media.id)
}

/**
 * Plantilla película vs. serie. El offset TMDB (+1M) NO indica película: las
 * series también lo usan (ej. Super 1062715). Solo formato/tipo deciden.
 */
export function isMovieLike(media: SafeMedia | null | undefined): boolean {
    if (!media) return false
    const format = normalizeToken(media.format)
    if (format !== null && MOVIE_FORMATS.has(format)) return true
    return normalizeToken(media.type) === "MOVIE"
}

/** Busca la serie canónica probando cada id tal cual y sin el offset TMDB. */
function findCanonicalSeries(...ids: unknown[]): DBFranchiseSeries | undefined {
    for (const raw of ids) {
        const id = toPositiveInt(raw)
        if (id === null) continue
        const hit = CANONICAL_BY_TMDB.get(id) ?? (id >= TMDB_OFFSET ? CANONICAL_BY_TMDB.get(id - TMDB_OFFSET) : undefined)
        if (hit) return hit
    }
    return undefined
}

function resolveTotalEpisodes(entry: MappableEntry, media: SafeMedia): number {
    // `episodes` no está en el tipo generado pero algunos payloads lo traen.
    const reported = toPositiveInt(media.totalEpisodes) ?? toPositiveInt((media as { episodes?: unknown }).episodes)
    if (reported !== null) return reported
    return findCanonicalSeries(entry.mediaId, media.tmdbId, media.id)?.totalEpisodes ?? 0
}

/** Score en escala 0–10; acepta 0–100 y strings numéricos. */
function normalizeScore(value: unknown): number | undefined {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined
    const score = n > 10 ? n / 10 : n
    return score > 10 ? undefined : score
}

function buildSubtitle(year: number | null, format: string | null): string {
    return [year, format].filter(part => part !== null).join(" · ")
}

/**
 * Maps a library entry to SwimlaneItem.
 */
export function mapLibraryEntryToMediaCard(
    entry: MappableEntry | null | undefined,
    onNavigate: NavigateFn,
): SwimlaneItem | null {
    if (!entry) return null
    const media: SafeMedia | null | undefined = entry.media
    if (!media) return null

    const targetId = resolveTargetId(entry, media)
    if (targetId === null) return null

    const movieLike = isMovieLike(media)
    const effectiveFormat = normalizeToken(media.format) ?? (movieLike ? "MOVIE" : null)
    const tmdbId = toPositiveInt(media.tmdbId)
    const year = toPositiveInt(media.year)
    const bannerImage = cleanString(media.bannerImage)
    const posterImage = cleanString(media.posterImage)

    const localFilesCount = toPositiveInt(entry.libraryData?.mainFileCount) ?? 0
    const totalEpisodesCount = resolveTotalEpisodes(entry, media)
    const isSeriesComplete = totalEpisodesCount > 0 && localFilesCount >= totalEpisodesCount
    const missingCount = Math.max(0, totalEpisodesCount - localFilesCount)

    const resolvedBackdrop = movieLike
        ? getMovieWidescreenBackdrop({ mediaId: targetId, tmdbId, bannerImage, posterImage })
        : getSeriesWidescreenBackdrop(tmdbId ?? targetId, bannerImage, posterImage)

    return {
        id: `media-${targetId}`,
        tmdbId: tmdbId ?? undefined,
        mediaId: toPositiveInt(entry.mediaId) ?? toPositiveInt(media.id) ?? undefined,
        image: posterImage || getBackdrop(media),
        title: getTitle(media),
        subtitle: buildSubtitle(year, effectiveFormat),
        badge: effectiveFormat ?? undefined,
        description: stripHtml(media.description),
        aspect: "poster",
        year: year ?? undefined,
        rating: normalizeScore(media.score),
        onClick: () => onNavigate(targetId),
        backdropUrl: resolvedBackdrop || bannerImage || undefined,
        localFilesCount,
        totalEpisodesCount,
        isSeriesComplete,
        missingCount,
    }
}

/**
 * Deduplica por id resuelto y mapea en una sola pasada (antes
 * filter + map + filter con un array intermedio).
 */
export function dedupeAndMapToSpotlight(
    entries: readonly (MappableEntry | null | undefined)[],
    onNavigate: NavigateFn,
): SwimlaneItem[] {
    const seen = new Set<number>()
    const items: SwimlaneItem[] = []
    for (const entry of entries) {
        if (!entry?.media) continue
        const key = resolveTargetId(entry, entry.media)
        if (key === null || seen.has(key)) continue
        seen.add(key)
        const item = mapLibraryEntryToMediaCard(entry, onNavigate)
        if (item) items.push(item)
    }
    return items
}
