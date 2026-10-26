import { describe, it, expect } from "vitest"
import {
    getHighResImage,
    getMediumResImage,
    getLowResImage,
    getLargeResImage,
    markImageLoaded,
    isImageLoaded,
    getPixelSampleImage,
    buildVideoThumbnailUrl,
    localImage,
    unproxyImage,
    withTmdbSize,
} from "./images"

describe("images helper", () => {
    describe("resolution replacements", () => {
        const tmdbUrlOriginal = "https://image.tmdb.org/t/p/original/sample_poster.jpg"
        const tmdbUrlW500 = "https://image.tmdb.org/t/p/w500/sample_poster.jpg"
        const nonTmdbUrl = "https://example.com/images/poster.jpg"

        it("rewrites TMDB URLs to w780 in getHighResImage", () => {
            expect(getHighResImage(tmdbUrlOriginal)).toBe("https://image.tmdb.org/t/p/w780/sample_poster.jpg")
            expect(getHighResImage(tmdbUrlW500)).toBe("https://image.tmdb.org/t/p/w780/sample_poster.jpg")
        })

        it("rewrites TMDB URLs to w342 in getMediumResImage", () => {
            expect(getMediumResImage(tmdbUrlOriginal)).toBe("https://image.tmdb.org/t/p/w342/sample_poster.jpg")
            expect(getMediumResImage(tmdbUrlW500)).toBe("https://image.tmdb.org/t/p/w342/sample_poster.jpg")
        })

        it("rewrites TMDB URLs to w185 in getLowResImage", () => {
            expect(getLowResImage(tmdbUrlOriginal)).toBe("https://image.tmdb.org/t/p/w185/sample_poster.jpg")
            expect(getLowResImage(tmdbUrlW500)).toBe("https://image.tmdb.org/t/p/w185/sample_poster.jpg")
        })

        it("rewrites TMDB URLs to w1280 in getLargeResImage", () => {
            expect(getLargeResImage(tmdbUrlOriginal)).toBe("https://image.tmdb.org/t/p/w1280/sample_poster.jpg")
            expect(getLargeResImage(tmdbUrlW500)).toBe("https://image.tmdb.org/t/p/w1280/sample_poster.jpg")
        })

        it("leaves non-TMDB URLs untouched", () => {
            expect(getHighResImage(nonTmdbUrl)).toBe(nonTmdbUrl)
            expect(getMediumResImage(nonTmdbUrl)).toBe(nonTmdbUrl)
            expect(getLowResImage(nonTmdbUrl)).toBe(nonTmdbUrl)
            expect(getLargeResImage(nonTmdbUrl)).toBe(nonTmdbUrl)
        })

        it("handles null, undefined, and empty string safely", () => {
            expect(getHighResImage(null)).toBe("")
            expect(getHighResImage(undefined)).toBe("")
            expect(getHighResImage("")).toBe("")

            expect(getMediumResImage(null)).toBe("")
            expect(getLowResImage(null)).toBe("")
            expect(getLargeResImage(null)).toBe("")
        })

        it("retrieves cached results consistently and handles cache overflow", () => {
            const url = "https://image.tmdb.org/t/p/w500/cached_item.jpg"
            const first = getHighResImage(url)
            const second = getHighResImage(url)
            expect(second).toBe(first)

            // Fill cache to verify overflow eviction doesn't crash or break resolution
            for (let i = 0; i < 520; i++) {
                getHighResImage(`https://image.tmdb.org/t/p/w500/overflow_${i}.jpg`)
            }
            expect(getHighResImage("https://image.tmdb.org/t/p/w500/overflow_519.jpg")).toBe(
                "https://image.tmdb.org/t/p/w780/overflow_519.jpg",
            )
        })
    })

    describe("image loaded and prewarmed state tracking", () => {
        it("tracks loaded image status and handles empty/null gracefully", () => {
            const url = "https://example.com/banner.jpg"
            expect(isImageLoaded(url)).toBe(false)
            expect(isImageLoaded(null)).toBe(false)

            markImageLoaded(url)
            expect(isImageLoaded(url)).toBe(true)

            // Null or empty calls do nothing
            markImageLoaded(null)
            markImageLoaded("")
        })

        it("evicts oldest loaded URL when exceeding MAX_LOADED_URLS (1500)", () => {
            for (let i = 0; i < 1510; i++) {
                markImageLoaded(`https://example.com/loaded_${i}.jpg`)
            }
            expect(isImageLoaded("https://example.com/loaded_1509.jpg")).toBe(true)
            expect(isImageLoaded("https://example.com/loaded_0.jpg")).toBe(false)
            // Una biblioteca de cientos de episodios no pierde lo recién visto.
            expect(isImageLoaded("https://example.com/loaded_900.jpg")).toBe(true)
        })
    })

    describe("getPixelSampleImage", () => {
        it("pide una versión chica de TMDB con clave de caché propia para CORS", () => {
            expect(getPixelSampleImage("https://image.tmdb.org/t/p/w1280/a.jpg")).toBe("https://image.tmdb.org/t/p/w300/a.jpg?kh-cors=1")
            expect(getPixelSampleImage("https://image.tmdb.org/t/p/original/b.jpg?x=1")).toBe("https://image.tmdb.org/t/p/w300/b.jpg?x=1&kh-cors=1")
        })

        it("no toca URLs locales ni vacías", () => {
            expect(getPixelSampleImage("/api/v1/image-proxy?url=x")).toBe("/api/v1/image-proxy?url=x")
            expect(getPixelSampleImage(null)).toBe("")
        })
    })

    describe("buildVideoThumbnailUrl", () => {
        const base = "http://127.0.0.1:43211"

        it("versiona la URL con mtime y tamaño del archivo", () => {
            expect(buildVideoThumbnailUrl({ path: "D:\\Anime\\ep 1.mkv", fileModTime: 1700000000, fileSize: 123456 }, { base }))
                .toBe(`${base}/api/v1/video-thumbnail?path=D%3A%5CAnime%5Cep+1.mkv&v=${(1700000000).toString(36)}-${(123456).toString(36)}`)
        })

        it("mantiene el orden path, t, v y redondea el segundo", () => {
            expect(buildVideoThumbnailUrl({ path: "/a.mkv", fileModTime: 10, fileSize: 20 }, { base, startSec: 12.6 }))
                .toBe(`${base}/api/v1/video-thumbnail?path=%2Fa.mkv&t=13&v=a-k`)
        })

        it("omite v sin datos del archivo y t cuando no hay segundo válido", () => {
            expect(buildVideoThumbnailUrl({ path: "/a.mkv" }, { base, startSec: -1 }))
                .toBe(`${base}/api/v1/video-thumbnail?path=%2Fa.mkv`)
        })
    })
})

describe("localImage", () => {
    it("pasa las imágenes de TMDB por el proxy local con la URL exacta", () => {
        const url = "https://image.tmdb.org/t/p/w342/p.jpg"
        const out = localImage(url)
        expect(out).toMatch(/\/api\/v1\/image-proxy\?url=/)
        expect(new URL(out, "http://local").searchParams.get("url")).toBe(url)
    })

    it("deja igual las rutas locales, otros hosts y los vacíos", () => {
        expect(localImage("/sagas/original/busqueda-esferas.webp")).toBe("/sagas/original/busqueda-esferas.webp")
        expect(localImage("https://example.com/a.jpg")).toBe("https://example.com/a.jpg")
        expect(localImage(null)).toBe("")
        expect(localImage("")).toBe("")
    })
})

describe("proxy local y tamaños de TMDB", () => {
    const raw = "https://image.tmdb.org/t/p/w780/abc.jpg"

    it("localImage es idempotente: aplicarlo dos veces no re-codifica la URL", () => {
        const once = localImage(raw)
        expect(localImage(once)).toBe(once)
    })

    it("unproxyImage devuelve la URL original de TMDB (y deja igual cualquier otra)", () => {
        expect(unproxyImage(localImage(raw))).toBe(raw)
        expect(unproxyImage(raw)).toBe(raw)
        expect(unproxyImage("/api/v1/image-proxy?url=%E0%A4%A")).toBe("/api/v1/image-proxy?url=%E0%A4%A")
        expect(unproxyImage("/sagas/a.webp")).toBe("/sagas/a.webp")
    })

    it("withTmdbSize cambia el tamaño también dentro de una URL del proxy", () => {
        const resized = withTmdbSize(localImage(raw), "w300")
        expect(resized).toMatch(/\/api\/v1\/image-proxy\?url=/)
        expect(unproxyImage(resized)).toBe("https://image.tmdb.org/t/p/w300/abc.jpg")
        // El resultado es exactamente el que se obtiene redimensionando primero y proxeando después.
        expect(resized).toBe(localImage(withTmdbSize(raw, "w300")))
    })

    it("withTmdbSize conserva los parámetros extra de la URL del proxy", () => {
        const withExtra = `${localImage(raw)}&kh-cors=1`
        const resized = withTmdbSize(withExtra, "w185")
        expect(resized.endsWith("&kh-cors=1")).toBe(true)
        expect(unproxyImage(resized)).toBe("https://image.tmdb.org/t/p/w185/abc.jpg")
    })

    it("withTmdbSize no toca una URL del proxy que no es de TMDB ni una ruta local", () => {
        const odd = "/api/v1/image-proxy?url=" + encodeURIComponent("https://example.com/a.jpg")
        expect(withTmdbSize(odd, "w300")).toBe(odd)
        expect(withTmdbSize("/sagas/a.webp", "w300")).toBe("/sagas/a.webp")
    })
})
