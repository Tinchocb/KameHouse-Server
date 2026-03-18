import type { Models_LibraryMedia, Continuity_WatchHistory } from "@/api/generated/types"

/**
 * Returns the best title for a media object.
 */
export function getTitle(media: Models_LibraryMedia): string {
    return media.titleEnglish || media.titleRomaji || media.titleOriginal || "Sin título"
}

/**
 * Calculates watch progress percentage.
 */
export function getProgress(mediaId: number, watchHistory?: Continuity_WatchHistory): number | undefined {
    const item = watchHistory?.[mediaId]
    if (!item?.duration) return undefined
    return (item.currentTime / item.duration) * 100
}

/**
 * Returns the backdrop/banner URL for a media object.
 */
export function getBackdrop(media: Models_LibraryMedia): string {
    return media.bannerImage || media.posterImage
}

/**
 * Dragon Ball franchise Platform IDs for special handling if needed.
 */
export const DRAGON_BALL_IDS = new Set([529, 813, 568, 30694, 6033, 107, 235])
