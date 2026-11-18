import { getServerBaseUrl } from "@/api/client/server-url"
import { authorizeResourceUrl } from "@/api/client/auth"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { queueIdlePreload } from "@/lib/idle-preload-queue"
import { isDataSavingEnabled } from "@/lib/network-preferences"

/**
 * Utility to ensure we always get the highest resolution image possible from TMDB or other providers.
 * TMDB often provides 'w500' or 'w780' by default, which can look blurry on high-PPI displays.
 */

/** URL de imagen de TMDB (con segmento de tamaño `/t/p/<size>/`). */
export function isTmdbImageUrl(url: string): boolean {
    return url.includes("tmdb.org") || url.includes("themoviedb.org")
}

const CORS_SAFE_IMAGE_PATH = /^\/api\/v1\/(?:image-proxy|video-thumbnail|thumbnail\/)/

/** URLs del servidor local o TMDB que responden con `Access-Control-Allow-Origin: *`. */
export function supportsAnonymousCors(url: string): boolean {
    if (!url) return false
    if (url.startsWith("/")) return CORS_SAFE_IMAGE_PATH.test(url)
    try {
        const parsed = new URL(url)
        return parsed.hostname === "image.tmdb.org" || CORS_SAFE_IMAGE_PATH.test(parsed.pathname)
    } catch {
        return false
    }
}

const TMDB_SIZE_SEGMENT = /\/t\/p\/(?:original|w\d+)/

const IMAGE_PROXY_QUERY = "/api/v1/image-proxy?url="

/** URL original de TMDB detrás de una del proxy local; cualquier otra se devuelve igual. */
export function unproxyImage(url: string): string {
    const at = url.indexOf(IMAGE_PROXY_QUERY)
    if (at < 0) return url
    const rest = url.slice(at + IMAGE_PROXY_QUERY.length)
    const end = rest.indexOf("&")
    try {
        return decodeURIComponent(end < 0 ? rest : rest.slice(0, end))
    } catch {
        return url
    }
}

/**
 * Cambia el tamaño de una URL de TMDB (`w185`, `w780`, `original`…). También
 * entiende las del proxy local, así el orden de `localImage` y los tamaños es
 * indistinto.
 */
export function withTmdbSize(url: string, size: string): string {
    const at = url.indexOf(IMAGE_PROXY_QUERY)
    if (at < 0) return url.replace(TMDB_SIZE_SEGMENT, `/t/p/${size}`)
    const raw = unproxyImage(url)
    if (raw === url) return url
    const resized = raw.replace(TMDB_SIZE_SEGMENT, `/t/p/${size}`)
    const rest = url.slice(at + IMAGE_PROXY_QUERY.length)
    const tail = rest.indexOf("&") < 0 ? "" : rest.slice(rest.indexOf("&"))
    return `${url.slice(0, at)}${IMAGE_PROXY_QUERY}${encodeURIComponent(resized)}${tail}`
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
    if (!/^https?:\/\/image\.tmdb\.org\//.test(url)) return authorizeResourceUrl(url)
    // La base va en la clave: en escritorio la UI pinta antes de que Tauri
    // resuelva el puerto del sidecar, y una URL cacheada con la base previa
    // quedaría apuntando al puerto equivocado para siempre.
    const base = getServerBaseUrl()
    return authorizeResourceUrl(getCachedOrResolve(`local:${base}|${url}`, () => `${base}/api/v1/image-proxy?url=${encodeURIComponent(url)}`))
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
        if (url.startsWith("/api/v1/image-proxy") || url.includes("/api/v1/image-proxy")) {
            return url
        }
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
    return authorizeResourceUrl(`${base}${API_ENDPOINTS.THUMBNAIL.GetVideoThumbnail.endpoint}?${params.toString()}`)
}

// Solo son cadenas: topes holgados para que una biblioteca grande (cientos de episodios y
// pósters) no pierda el recuerdo de lo ya visto y vuelva a mostrar el shimmer al regresar.
const MAX_PREWARMED_URLS = 1500
const prewarmedUrls = new Set<string>()

// URLs cuya descarga ya terminó (onLoad real): sirven para no flashear
// el skeleton al rotar a una era cuya imagen ya vimos o ya se prewarmeó.
const loadedUrls = new Set<string>()
const MAX_LOADED_URLS = 1500

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

/** Descarga y decodifica una imagen por turno de la cola compartida. */
export const prewarmImages = (urls: (string | null | undefined)[]) => {
    if (typeof window === "undefined" || isDataSavingEnabled()) return
    for (const url of urls) {
        if (!url || prewarmedUrls.has(url)) continue
        if (prewarmedUrls.size >= MAX_PREWARMED_URLS) {
            const first = prewarmedUrls.values().next().value
            if (first) prewarmedUrls.delete(first)
        }
        prewarmedUrls.add(url)
        queueIdlePreload(`image:${url}`, () => new Promise<void>((resolve) => {
            const img = new Image()
            if (supportsAnonymousCors(url)) img.crossOrigin = "anonymous"
            img.decoding = "async"
            img.fetchPriority = "low"
            let settled = false
            const finish = (loaded: boolean) => {
                if (settled) return
                settled = true
                clearTimeout(timeout)
                img.onload = null
                img.onerror = null
                if (loaded) markImageLoaded(url)
                else {
                    prewarmedUrls.delete(url)
                    img.removeAttribute("src")
                }
                resolve()
            }
            // Un host que no responde no puede detener las demás precargas.
            const timeout = setTimeout(() => finish(false), 15000)
            img.onload = () => {
                void (img.decode ? img.decode() : Promise.resolve())
                    .then(() => finish(true), () => finish(false))
            }
            img.onerror = () => finish(false)
            img.src = url
        }))
    }
}


