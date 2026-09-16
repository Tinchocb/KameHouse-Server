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
        // TMDB high-res replacement: w780 provides crystal-clear 4K crispness (~120KB)
        // avoiding the disastrous 10MB-15MB payload and multi-second latency of /original.
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w780")
        }
        return url
    })
}

export const getMediumResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`medium:${url}`, () => {
        // TMDB medium-res: w342 is crisp on 160-240px cards and Retina (2x) without the 4x payload of w780
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            return url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w342")
        }
        return url
    })
}

/**
 * Optimización para tarjetas y posters de catálogo (alias de getMediumResImage).
 */
export const getCardPosterImage = getMediumResImage

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
        // Local image proxy thumbnail if supported
        if (url.startsWith("/api/v1/image") && !url.includes("thumbnail=")) {
            const separator = url.includes("?") ? "&" : "?"
            return `${url}${separator}thumbnail=true&w=92`
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

const MAX_PREWARMED_URLS = 200
const prewarmedUrls = new Set<string>()

/**
 * Precarga imágenes predictivamente en segundo plano en idle time
 * usando HTMLImageElement sin bloquear el hilo principal.
 */
export const prewarmImages = (urls: (string | null | undefined)[]) => {
    if (typeof window === "undefined") return

    const schedule = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200))
    schedule(() => {
        urls.forEach((url) => {
            if (!url || prewarmedUrls.has(url)) return
            if (prewarmedUrls.size >= MAX_PREWARMED_URLS) {
                const first = prewarmedUrls.values().next().value
                if (first) prewarmedUrls.delete(first)
            }
            prewarmedUrls.add(url)
            const img = new Image()
            img.src = url
        })
    }, { timeout: 2000 })
}

