import { getServerBaseUrl } from "@/api/client/server-url"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

/**
 * Utility to ensure we always get the highest resolution image possible from TMDB or other providers.
 * TMDB often provides 'w500' or 'w780' by default, which can look blurry on high-PPI displays.
 */

/** URL de imagen de TMDB (con segmento de tamaño `/t/p/<size>/`). */
export function isTmdbImageUrl(url: string): boolean {
    return url.includes("tmdb.org") || url.includes("themoviedb.org")
}

const TMDB_SIZE_SEGMENT = /\/t\/p\/(?:original|w\d+)/

/** Cambia el tamaño de una URL de TMDB (`w185`, `w780`, `original`…). */
export function withTmdbSize(url: string, size: string): string {
    return url.replace(TMDB_SIZE_SEGMENT, `/t/p/${size}`)
}

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
        if (isTmdbImageUrl(url)) {
            return withTmdbSize(url, "w780")
        }
        return url
    })
}

export const getMediumResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`medium:${url}`, () => {
        // TMDB medium-res: w342 is crisp on 160-240px cards and Retina (2x) without the 4x payload of w780
        if (isTmdbImageUrl(url)) {
            return withTmdbSize(url, "w342")
        }
        return url
    })
}

export const getLowResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`low:${url}`, () => {
        // TMDB low-res replacement (w185 is perfect for blurred background glows / placeholders)
        if (isTmdbImageUrl(url)) {
            return withTmdbSize(url, "w185")
        }
        return url
    })
}

/**
 * Imagen de TMDB servida por el proxy local (/api/v1/image-proxy): el servidor
 * la guarda en disco la primera vez (y precalienta las de la estantería al
 * arrancar), así carga en milisegundos, también sin conexión. Aplicar al
 * final, sobre la URL ya dimensionada: codificada, getLowResImage y compañía
 * ya no la reconocen.
 */
export const localImage = (url: string | null | undefined): string => {
    if (!url) return ""
    if (!/^https?:\/\/image\.tmdb\.org\//.test(url)) return url
    // La base va en la clave: en escritorio la UI pinta antes de que Tauri
    // resuelva el puerto del sidecar, y una URL cacheada con la base previa
    // quedaría apuntando al puerto equivocado para siempre.
    const base = getServerBaseUrl()
    return getCachedOrResolve(`local:${base}|${url}`, () => `${base}/api/v1/image-proxy?url=${encodeURIComponent(url)}`)
}

export const getLargeResImage = (url: string | null | undefined): string => {
    if (!url) return ""

    return getCachedOrResolve(`large:${url}`, () => {
        // TMDB large-res replacement (w1280 is sharp on large display panels without the raw overhead of 'original')
        if (isTmdbImageUrl(url)) {
            return withTmdbSize(url, "w1280")
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
        if (isTmdbImageUrl(url)) {
            const resized = withTmdbSize(url, "w300")
            return `${resized}${resized.includes("?") ? "&" : "?"}kh-cors=1`
        }
        return url
    })
}

interface VideoThumbnailSource {
    path: string
    fileModTime?: number | null
    fileSize?: number | null
}

/**
 * URL del frame que extrae el servidor (`/api/v1/video-thumbnail`).
 *
 * Con `fileModTime` y `fileSize` agrega `v`, que cambia cuando cambia el archivo:
 * el servidor la responde como `immutable` y el navegador no la vuelve a pedir.
 * Los parámetros van siempre en el mismo orden para que cada imagen tenga una sola
 * URL y, por lo tanto, una sola entrada de caché.
 */
export const buildVideoThumbnailUrl = (
    source: VideoThumbnailSource,
    options: { startSec?: number | null; base?: string } = {},
): string => {
    const params = new URLSearchParams({ path: source.path })
    if (options.startSec != null && options.startSec >= 0) {
        params.set("t", String(Math.round(options.startSec)))
    }
    if (source.fileModTime && source.fileSize) {
        params.set("v", `${source.fileModTime.toString(36)}-${source.fileSize.toString(36)}`)
    }
    const base = options.base ?? getServerBaseUrl()
    return `${base}${API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.endpoint}?${params.toString()}`
}

const MAX_PREWARMED_URLS = 200
const prewarmedUrls = new Set<string>()

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
// Pocas a la vez: con HTTP/1.1 el navegador abre ~6 conexiones por host, y
// cientos de pósters en vuelo encolaban detrás las llamadas reales a la API.
const PREWARM_CONCURRENCY = 4
const prewarmQueue: string[] = []
let prewarmInFlight = 0

const pumpPrewarmQueue = () => {
    while (prewarmInFlight < PREWARM_CONCURRENCY && prewarmQueue.length > 0) {
        const url = prewarmQueue.shift()
        if (!url) break
        prewarmInFlight++
        const img = new Image()
        img.decoding = 'async'
        if ('fetchPriority' in img) {
            (img as { fetchPriority: string }).fetchPriority = 'low'
        }
        const done = () => {
            prewarmInFlight--
            pumpPrewarmQueue()
        }
        img.onload = () => {
            markImageLoaded(url)
            // Decodificada de antemano: el primer pintado no espera el bitmap.
            if (img.decode) void img.decode().catch(() => {}).finally(done)
            else done()
        }
        img.onerror = done
        img.src = url
    }
}

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
            prewarmQueue.push(url)
        })
        pumpPrewarmQueue()
    }, { timeout: 2000 })
}


