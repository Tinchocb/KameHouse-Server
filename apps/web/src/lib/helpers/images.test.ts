import { describe, it, expect } from "vitest"
import {
    getHighResImage,
    getMediumResImage,
    getLowResImage,
    getLargeResImage,
    isImagePrewarmed,
    markImageLoaded,
    isImageLoaded,
    getPixelSampleImage,
    buildVideoThumbnailUrl,
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

        it("evicts oldest loaded URL when exceeding MAX_LOADED_URLS (200)", () => {
            for (let i = 0; i < 210; i++) {
                markImageLoaded(`https://example.com/loaded_${i}.jpg`)
            }
            expect(isImageLoaded("https://example.com/loaded_209.jpg")).toBe(true)
        })

        it("checks prewarmed status correctly", () => {
            expect(isImagePrewarmed(null)).toBe(false)
            expect(isImagePrewarmed("https://not-prewarmed.com/test.jpg")).toBe(false)
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
