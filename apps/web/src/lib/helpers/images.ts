/**
 * Utility to ensure we always get the highest resolution image possible from TMDB or other providers.
 * TMDB often provides 'w500' or 'w780' by default, which can look blurry on high-PPI displays.
 */

const cacheMap = new Map<string, string>()
const MAX_CACHE_SIZE = 500

const getCachedOrResolve = (key: string, resolver: () => string): string => {
    if (cacheMap.has(key)) {
        return cacheMap.get(key)!
    }
    const resolved = resolver()
    if (cacheMap.size >= MAX_CACHE_SIZE) {
        const firstKey = cacheMap.keys().next().value
        if (firstKey !== undefined) {
            cacheMap.delete(firstKey)
        }
    }
    cacheMap.set(key, resolved)
    return resolved
}

export const getHighResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`high:${url}`, () => {
        // TMDB high-res replacement
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            // Replace common width segments with 'original'
            // Examples: /t/p/w500/..., /t/p/w780/..., /t/p/w1280/...
            return url.replace(/\/t\/p\/w\d+/, "/t/p/original")
        }
        return url
    })
}

export const getMediumResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`medium:${url}`, () => {
        // TMDB medium-res replacement (w500 is perfect for normal-sized cards and posters)
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w500")
        }
        return url
    })
}

export const getLowResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`low:${url}`, () => {
        // TMDB low-res replacement (w185 is perfect for blurred background glows / placeholders)
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w185")
        }
        return url
    })
}

export const getTinyResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`tiny:${url}`, () => {
        // TMDB tiny-res replacement (w92 is perfect for instant LQIP blur placeholders)
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w92")
        }
        return url
    })
}

export const getLargeResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`large:${url}`, () => {
        // TMDB large-res replacement (w1280 is sharp on large display panels without the raw overhead of 'original')
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w1280")
        }
        return url
    })
}
