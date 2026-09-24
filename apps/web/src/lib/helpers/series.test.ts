import { describe, it, expect } from "vitest"
import {
    getSeriesEraId,
    getSeriesEraAccent,
    getSeriesIdFromMedia,
    getSeriesYear,
    DRAGON_BALL_SERIES_INFO,
    DRAGON_BALL_SERIES_ORDER,
    DAIMA_VERTICAL_POSTER,
} from "./series"

describe("series helper", () => {
    describe("getSeriesEraId", () => {
        it("maps canonical series IDs to EraIds", () => {
            expect(getSeriesEraId("dragon_ball")).toBe("db")
            expect(getSeriesEraId("dragon_ball_z")).toBe("dbz")
            expect(getSeriesEraId("dragon_ball_gt")).toBe("dbgt")
            expect(getSeriesEraId("dragon_ball_kai")).toBe("dbkai")
            expect(getSeriesEraId("dragon_ball_super")).toBe("dbs")
            expect(getSeriesEraId("dragon_ball_daima")).toBe("dbdaima")
        })

        it("returns null for unknown, null, or empty seriesId", () => {
            expect(getSeriesEraId(null)).toBeNull()
            expect(getSeriesEraId(undefined)).toBeNull()
            expect(getSeriesEraId("")).toBeNull()
            expect(getSeriesEraId("unknown_series")).toBeNull()
        })
    })

    describe("getSeriesEraAccent", () => {
        it("returns the canonical accent for recognized series", () => {
            const dbzAccent = getSeriesEraAccent("dragon_ball_z")
            expect(dbzAccent).toBeDefined()
            expect(typeof dbzAccent).toBe("string")
            expect(dbzAccent.length).toBeGreaterThan(0)
        })

        it("returns default or custom fallback when series is unknown or null", () => {
            expect(getSeriesEraAccent(null)).toBe("var(--spotlight-dbz-vivid)")
            expect(getSeriesEraAccent("custom_show", "#ff0000")).toBe("#ff0000")
        })
    })

    describe("DRAGON_BALL_SERIES_INFO & ORDER", () => {
        it("contains metadata and chronological order for all 6 core series", () => {
            const seriesKeys = [
                "dragon_ball",
                "dragon_ball_z",
                "dragon_ball_gt",
                "dragon_ball_kai",
                "dragon_ball_super",
                "dragon_ball_daima",
            ]

            seriesKeys.forEach((key, index) => {
                const info = DRAGON_BALL_SERIES_INFO[key]
                expect(info).toBeDefined()
                expect(info.year).toBeGreaterThan(1980)
                expect(info.episodes).toBeGreaterThan(0)
                expect(info.title).toBeTruthy()
                expect(DRAGON_BALL_SERIES_ORDER[key]).toBe(index + 1)
            })

            expect(DRAGON_BALL_SERIES_INFO.dragon_ball_daima.poster).toBe(DAIMA_VERTICAL_POSTER)
        })
    })

    describe("getSeriesIdFromMedia", () => {
        it("maps TMDB IDs directly", () => {
            expect(getSeriesIdFromMedia({ tmdbId: 12609 })).toBe("dragon_ball")
            expect(getSeriesIdFromMedia({ tmdbId: 12971 })).toBe("dragon_ball_z")
            expect(getSeriesIdFromMedia({ tmdbId: 12697 })).toBe("dragon_ball_gt")
            expect(getSeriesIdFromMedia({ tmdbId: 61709 })).toBe("dragon_ball_kai")
            expect(getSeriesIdFromMedia({ tmdbId: 42705 })).toBe("dragon_ball_kai")
            expect(getSeriesIdFromMedia({ tmdbId: 62715 })).toBe("dragon_ball_super")
            expect(getSeriesIdFromMedia({ tmdbId: 236994 })).toBe("dragon_ball_daima")
        })

        it("handles offset TMDB IDs (e.g. 1000000+)", () => {
            expect(getSeriesIdFromMedia({ tmdbId: 1012971 })).toBe("dragon_ball_z")
        })

        it("infers series ID from titles if tmdbId is missing or unknown", () => {
            expect(getSeriesIdFromMedia({ titleSpanish: "Dragon Ball Daima" })).toBe("dragon_ball_daima")
            expect(getSeriesIdFromMedia({ titleRomaji: "Dragon Ball Super" })).toBe("dragon_ball_super")
            expect(getSeriesIdFromMedia({ titleEnglish: "DBS: Broly" })).toBe("dragon_ball_super")
            expect(getSeriesIdFromMedia({ titleOriginal: "Dragon Ball GT" })).toBe("dragon_ball_gt")
            expect(getSeriesIdFromMedia({ titleEnglish: "DBGT" })).toBe("dragon_ball_gt")
            expect(getSeriesIdFromMedia({ titleSpanish: "Dragon Ball Kai" })).toBe("dragon_ball_kai")
            expect(getSeriesIdFromMedia({ titleRomaji: "DBKai" })).toBe("dragon_ball_kai")
            expect(getSeriesIdFromMedia({ titleEnglish: "Dragon Ball Z" })).toBe("dragon_ball_z")
            expect(getSeriesIdFromMedia({ titleEnglish: "DBZ" })).toBe("dragon_ball_z")
            expect(getSeriesIdFromMedia({ titleEnglish: "Dragon Ball Z: Fusión" })).toBe("dragon_ball_z")
            expect(getSeriesIdFromMedia({ titleRomaji: "Dragon Ball" })).toBe("dragon_ball")
            expect(getSeriesIdFromMedia(null, "Dragonball")).toBe("dragon_ball")
        })

        it("returns empty string when no match is found or input is empty", () => {
            expect(getSeriesIdFromMedia(null)).toBe("")
            expect(getSeriesIdFromMedia(undefined)).toBe("")
            expect(getSeriesIdFromMedia({ titleRomaji: "Naruto Shippuden" })).toBe("")
        })
    })

    describe("getSeriesYear", () => {
        it("resolves year from DRAGON_BALL_SERIES_INFO when valid seriesId is provided", () => {
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball")).toBe(1986)
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball_z")).toBe(1989)
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball_gt")).toBe(1996)
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball_kai")).toBe(2009)
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball_super")).toBe(2015)
            expect(getSeriesYear("Unknown", undefined, undefined, "dragon_ball_daima")).toBe(2024)
        })

        it("infers canonical year from title keywords", () => {
            expect(getSeriesYear("Dragon Ball Daima")).toBe(2024)
            expect(getSeriesYear("Dragon Ball Super")).toBe(2015)
            expect(getSeriesYear("Dragon Ball Kai")).toBe(2009)
            expect(getSeriesYear("Seldion DB")).toBe(2009)
            expect(getSeriesYear("Dragon Ball GT")).toBe(1996)
            expect(getSeriesYear("Dragon Ball Z")).toBe(1989)
            expect(getSeriesYear("DBZ Saga")).toBe(1989)
            expect(getSeriesYear("Dragon Ball Original")).toBe(1986)
        })

        it("parses year from startDate string", () => {
            expect(getSeriesYear("Movie Special", undefined, "1993-07-10")).toBe(1993)
        })

        it("falls back to mediaYear number if valid", () => {
            expect(getSeriesYear("Movie Special", 2008)).toBe(2008)
        })

        it("returns 'N/A' when no valid year can be determined", () => {
            expect(getSeriesYear("Random Special")).toBe("N/A")
            expect(getSeriesYear("Random Special", 0, "invalid-date")).toBe("N/A")
        })
    })
})
