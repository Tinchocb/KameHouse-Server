/**
 * Utility to ensure we always get the highest resolution image possible from TMDB or other providers.
 * TMDB often provides 'w500' or 'w780' by default, which can look blurry on high-PPI displays.
 */
export const getHighResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    // TMDB high-res replacement
    if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
        // Replace common width segments with 'original'
        // Examples: /t/p/w500/..., /t/p/w780/..., /t/p/w1280/...
        return url.replace(/\/t\/p\/w\d+/, "/t/p/original")
    }

    // AniList already provides 'large' or 'extraLarge' in the URL if it's from their CDN
    // but we can ensure it's not a small thumbnail if we detect patterns.

    return url
}

export const getMediumResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    // TMDB medium-res replacement (w500 is perfect for normal-sized cards and posters)
    if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
        return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w500")
    }

    return url
}

export const getLowResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    // TMDB low-res replacement (w185 is perfect for blurred background glows / placeholders)
    if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
        return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w185")
    }

    return url
}

