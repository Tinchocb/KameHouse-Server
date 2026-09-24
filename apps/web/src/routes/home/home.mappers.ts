import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { IntelligentEntry } from "@/api/types/intelligence.types"
import { getTitle, getBackdrop } from "./home.helpers"

import { DRAGON_BALL_SCANNER_SERIES } from "@/lib/config/dragonball_scanner_series"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getMovieWidescreenBackdrop, getSeriesWidescreenBackdrop } from "@/lib/config/hero-art"

/**
 * Maps a library entry to SwimlaneItem.
 */
export function mapLibraryEntryToMediaCard(
    entry: Anime_LibraryCollectionEntry | IntelligentEntry | null | undefined,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem | null {
    if (!entry) return null
    const media = entry?.media
    if (!media) return null
    const rawMediaId = entry.mediaId || media.tmdbId || media.id
    const targetId = rawMediaId
    // El offset TMDB (+1M) NO indica película: las series también lo usan.
    const isMovieLike = media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA" || media.type === "MOVIE"
    const effectiveFormat = media.format || (isMovieLike ? "MOVIE" : undefined)

    const localFilesCount = entry.libraryData?.mainFileCount ?? 0
    const rawTotalEpisodes = (media as { totalEpisodes?: number; episodes?: number }).totalEpisodes ?? (media as { totalEpisodes?: number; episodes?: number }).episodes ?? 0
    const canonicalSeries = DRAGON_BALL_SCANNER_SERIES.find(s => s.tmdbId === rawMediaId || s.tmdbId === media.tmdbId || s.tmdbId === media.id)
    const totalEpisodesCount = rawTotalEpisodes > 0 ? rawTotalEpisodes : (canonicalSeries?.totalEpisodes ?? 0)
    const isSeriesComplete = totalEpisodesCount > 0 && localFilesCount >= totalEpisodesCount
    const missingCount = Math.max(0, totalEpisodesCount - localFilesCount)

    const resolvedBackdrop = isMovieLike
        ? getMovieWidescreenBackdrop({ mediaId: targetId, tmdbId: media.tmdbId, bannerImage: media.bannerImage, posterImage: media.posterImage })
        : getSeriesWidescreenBackdrop(media.tmdbId || targetId, media.bannerImage, media.posterImage)

    return {
        id: `media-${targetId}`,
        tmdbId: media.tmdbId ?? undefined,
        mediaId: entry.mediaId ?? media.id ?? undefined,
        image: media.posterImage || getBackdrop(media) || "",
        title: getTitle(media),
        subtitle: `${media.year || ""} · ${effectiveFormat || ""}`,
        badge: effectiveFormat,
        description: stripHtml(media.description),
        aspect: "poster",
        year: media.year || undefined,
        rating: media.score ? (media.score > 10 ? media.score / 10 : media.score) : undefined,
        onClick: () => onNavigate(targetId),
        backdropUrl: resolvedBackdrop || media.bannerImage || undefined,
        localFilesCount,
        totalEpisodesCount,
        isSeriesComplete,
        missingCount,
    }
}

