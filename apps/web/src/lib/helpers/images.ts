/**
 * Utility to ensure we always get the highest resolution image possible from TMDB or other providers.
 * TMDB often provides 'w500' or 'w780' by default, which can look blurry on high-PPI displays.
 */

const cacheMap = new Map<string, string>()
const MAX_CACHE_SIZE = 500

const getCachedOrResolve = (key: string, resolver: () => string): string => {
    const cached = cacheMap.get(key)
    if (cached !== undefined) {
        return cached
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

/**
 * URL apta para leer píxeles en un canvas (paletas, colores dominantes).
 *
 * TMDB solo responde `Access-Control-Allow-Origin` cuando la petición trae
 * `Origin`, y no envía `Vary: Origin`. Si un `<img>` ya cacheó la imagen sin
 * CORS, la petición `crossOrigin="anonymous"` reutiliza esa respuesta y el
 * navegador la bloquea. Un parámetro propio separa la entrada de caché, y
 * w300 alcanza para promediar colores sin descargar de nuevo el backdrop.
 */
export const getPixelSampleImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`sample:${url}`, () => {
        if (url.includes("tmdb.org") || url.includes("themoviedb.org")) {
            const resized = url.replace(/\/t\/p\/(?:original|w\d+)/, "/t/p/w300")
            return `${resized}${resized.includes("?") ? "&" : "?"}kh-cors=1`
        }
        return url
    })
}

const MAX_PREWARMED_URLS = 200
const prewarmedUrls = new Set<string>()

export const isImagePrewarmed = (url: string | null | undefined): boolean => {
    if (!url) return false
    return prewarmedUrls.has(url)
}

// URLs cuya descarga ya terminó (onLoad real): sirven para no flashear
// el skeleton al rotar a una era cuya imagen ya vimos o ya se prewarmeó.
const loadedUrls = new Set<string>()
const MAX_LOADED_URLS = 200

export const markImageLoaded = (url: string | null | undefined): void => {
    if (!url) return
    if (loadedUrls.size >= MAX_LOADED_URLS) {
        const first = loadedUrls.values().next().value
        if (first) loadedUrls.delete(first)
    }
    loadedUrls.add(url)
}

export const isImageLoaded = (url: string | null | undefined): boolean => {
    if (!url) return false
    return loadedUrls.has(url)
}

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
            img.decoding = 'async'
            if ('fetchPriority' in img) {
                (img as { fetchPriority: string }).fetchPriority = 'low'
            }
            img.onload = () => markImageLoaded(url)
            img.src = url
        })
    }, { timeout: 2000 })
}


