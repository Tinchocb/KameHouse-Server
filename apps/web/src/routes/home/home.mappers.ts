import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { IntelligentEntry } from "@/api/types/intelligence.types"
import { getTitle, getBackdrop } from "./home.helpers"

import { DRAGON_BALL_SCANNER_SERIES } from "@/lib/config/dragonball_scanner_series"
import { stripHtml } from "@/lib/helpers/sanitizer"

/**
 * Maps a library entry to SwimlaneItem.
 */
export function mapLibraryEntryToMediaCard(
    entry: Anime_LibraryCollectionEntry | IntelligentEntry,
    onNavigate: (mediaId: number) => void,
): SwimlaneItem {
    const media = entry.media!
    const rawMediaId = entry.mediaId || media.tmdbId || media.id
    const targetId = rawMediaId
    const isMovieLike = media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA" || media.type === "MOVIE" || (rawMediaId && rawMediaId >= 1_000_000)
    const effectiveFormat = media.format || (isMovieLike ? "MOVIE" : undefined)

    const localFilesCount = entry.libraryData?.mainFileCount ?? 0
    const rawTotalEpisodes = (media as { totalEpisodes?: number; episodes?: number }).totalEpisodes ?? (media as { totalEpisodes?: number; episodes?: number }).episodes ?? 0
    const canonicalSeries = DRAGON_BALL_SCANNER_SERIES.find(s => s.tmdbId === rawMediaId || s.tmdbId === media.tmdbId || s.tmdbId === media.id)
    const totalEpisodesCount = rawTotalEpisodes > 0 ? rawTotalEpisodes : (canonicalSeries?.totalEpisodes ?? 0)
    const isSeriesComplete = totalEpisodesCount > 0 && localFilesCount >= totalEpisodesCount

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
        backdropUrl: media.bannerImage || undefined,
        localFilesCount,
        totalEpisodesCount,
        isSeriesComplete,
    }
}

