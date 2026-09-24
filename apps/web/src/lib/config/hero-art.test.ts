import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
    DEFAULT_MOVIE_FOCAL,
    MOVIE_HERO_ART,
    SERIES_HERO_ART,
    getMovieHeroArt,
    getSeriesHeroArt,
    heroObjectPosition,
} from "./hero-art"

const publicPath = (src: string) => resolve(__dirname, "../../../public", src.replace(/^\//, ""))

describe("hero-art registry", () => {
    // Sumar una imagen nueva al registro sin subir el archivo (o su LQIP)
    // tiene que romper acá, no en producción con un hero vacío.
    it.each(Object.entries(SERIES_HERO_ART))("%s: local image and LQIP exist", (_era, art) => {
        expect(existsSync(publicPath(art.src))).toBe(true)
        expect(art.lowRes).toBeDefined()
        if (art.lowRes === undefined) throw new Error(`Missing lowRes for ${_era}`)
        expect(existsSync(publicPath(art.lowRes))).toBe(true)
    })

    it("keeps every focal point inside the image", () => {
        for (const art of [...Object.values(SERIES_HERO_ART), ...Object.values(MOVIE_HERO_ART)]) {
            expect(art.focal.x).toBeGreaterThanOrEqual(0)
            expect(art.focal.x).toBeLessThanOrEqual(100)
            expect(art.focal.y).toBeGreaterThanOrEqual(0)
            expect(art.focal.y).toBeLessThanOrEqual(100)
        }
    })

    it("formats the focal point as CSS object-position", () => {
        expect(heroObjectPosition({ focal: { x: 78, y: 40 } })).toBe("78% 40%")
    })

    it("keeps safeTop in frame on ultra-wide containers", () => {
        // 1600×558: el 16:9 se renderiza a 900 de alto, sobran 342 px.
        // focal.y 38 recortaría 130 px por arriba; safeTop 9 lo topa en 81.
        const art = { focal: { x: 66, y: 38 }, safeTop: 9 }
        expect(heroObjectPosition(art, { width: 1600, height: 558 })).toBe("66% 23.7%")
    })

    it("leaves the focal untouched when safeTop is not at risk or there is no vertical crop", () => {
        const art = { focal: { x: 50, y: 48 }, safeTop: 15 }
        // Card del Home ≈ 1.93:1: recorte mínimo, 48% de 67 px no llega al 15%.
        expect(heroObjectPosition(art, { width: 1518, height: 786 })).toBe("50% 48%")
        // Mobile vertical: cover recorta a los lados, no arriba.
        expect(heroObjectPosition(art, { width: 390, height: 700 })).toBe("50% 48%")
    })

    it("uses the declared aspect for non-16:9 art", () => {
        const poster = { focal: { x: 50, y: 25 }, aspect: 2 / 3, safeTop: 100 }
        expect(heroObjectPosition(poster, { width: 1600, height: 558 })).toBe("50% 25%")
    })

    it("every curated series art declares a safeTop", () => {
        for (const art of Object.values(SERIES_HERO_ART)) {
            expect(art.safeTop).toBeGreaterThanOrEqual(0)
            expect(art.safeTop).toBeLessThanOrEqual(100)
        }
    })
})

describe("getSeriesHeroArt", () => {
    it("resolves by era id, case-insensitively", () => {
        expect(getSeriesHeroArt("dbgt")).toBe(SERIES_HERO_ART.dbgt)
        expect(getSeriesHeroArt("DBZ")).toBe(SERIES_HERO_ART.dbz)
    })

    it("resolves by TMDB id with and without the 1_000_000 offset", () => {
        expect(getSeriesHeroArt(12971)).toBe(SERIES_HERO_ART.dbz)
        expect(getSeriesHeroArt(1_012_971)).toBe(SERIES_HERO_ART.dbz)
    })

    it("falls back to a banner only when it is not the poster", () => {
        expect(getSeriesHeroArt(999, "/banner.jpg", "/poster.jpg")?.src).toBe("/banner.jpg")
        expect(getSeriesHeroArt(999, "/same.jpg", "/same.jpg")).toBeNull()
        expect(getSeriesHeroArt(999)).toBeNull()
    })
})

describe("getMovieHeroArt", () => {
    it("resolves by TMDB id, offset id and legacy media id", () => {
        const broly = MOVIE_HERO_ART[503314]
        expect(getMovieHeroArt({ tmdbId: 503314 })).toBe(broly)
        expect(getMovieHeroArt({ tmdbId: 1_503_314 })).toBe(broly)
        expect(getMovieHeroArt(15455)).toBe(MOVIE_HERO_ART[15455])
    })

    it("uses a non-poster banner with the movie framing, never the poster", () => {
        const art = getMovieHeroArt({ mediaId: 1, bannerImage: "/b.jpg", posterImage: "/p.jpg" })
        expect(art?.src).toBe("/b.jpg")
        expect(art?.focal).toEqual(DEFAULT_MOVIE_FOCAL)
        expect(getMovieHeroArt({ mediaId: 1, bannerImage: "/p.jpg", posterImage: "/p.jpg" })).toBeNull()
        expect(getMovieHeroArt(null)).toBeNull()
    })
})
