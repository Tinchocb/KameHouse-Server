import { describe, it, expect } from "vitest"
import { DRAGON_BALL_STORY_SPANS } from "./dragonball_story_spans"
import {
    getMoviesForSpan,
    getGokuAgeForSpan,
    getUniverseLoreForSpan,
    LORE_MOVIE_TO_TMDB_MAP,
} from "./dragonball_chronology_enrichment"

describe("Dragon Ball Chronology Enrichment", () => {
    it("should correctly map movies to spans and have valid TMDB IDs", () => {
        const raditzSpan = DRAGON_BALL_STORY_SPANS.find(s => s.id === "dbz-saiyajin-raditz")
        expect(raditzSpan).toBeDefined()
        if (!raditzSpan) return

        const movies = getMoviesForSpan(raditzSpan)
        expect(movies.length).toBeGreaterThan(0)
        // Should include Bardock special and Dead Zone
        expect(movies.some(m => m.id === "sp1")).toBe(true)
        expect(movies.some(m => m.id === "m5")).toBe(true)

        for (const m of movies) {
            expect(m.title).toBeTruthy()
            expect(m.chronologyNotes).toBeTruthy()
            expect(m.tmdbId).toBeDefined()
            expect(typeof m.tmdbId).toBe("number")
        }
    })

    it("should provide in-universe Goku age for all 33 spans", () => {
        for (const span of DRAGON_BALL_STORY_SPANS) {
            const ageInfo = getGokuAgeForSpan(span.id)
            expect(ageInfo.physical).toBeTruthy()
            expect(ageInfo.notes).toBeTruthy()
        }

        // Specific test cases
        expect(getGokuAgeForSpan("db-pilaf").physical).toContain("12")
        expect(getGokuAgeForSpan("dbz-saiyajin-raditz").physical).toContain("24")
        expect(getGokuAgeForSpan("dbz-buu-kid-buu").physical).toContain("37")
        expect(getGokuAgeForSpan("dbs-dioses").physical).toContain("41")
        expect(getGokuAgeForSpan("dbgt-baby").physical).toContain("SSJ4")
    })

    it("should provide universe lore (debuts, transformations, deaths, wishes) for story spans", () => {
        const pilafLore = getUniverseLoreForSpan("db-pilaf")
        expect(pilafLore.debuts).toContain("Son Goku")
        expect(pilafLore.debuts).toContain("Bulma")
        expect(pilafLore.transformations.some(t => t.includes("Oozaru"))).toBe(true)
        expect(pilafLore.wishes.some(w => w.includes("Oolong"))).toBe(true)

        const cellLore = getUniverseLoreForSpan("dbz-juegos-de-cell")
        expect(cellLore.transformations.some(t => t.includes("Super Saiyajin 2"))).toBe(true)
        expect(cellLore.deaths.some(d => d.includes("Cell"))).toBe(true)
    })

    it("should map TMDB movie IDs bidirectionally without NaN or invalid keys", () => {
        expect(LORE_MOVIE_TO_TMDB_MAP["m1"]).toBe(39144)
        expect(LORE_MOVIE_TO_TMDB_MAP["m18"]).toBe(177572)
        expect(LORE_MOVIE_TO_TMDB_MAP["sp1"]).toBe(39323)
    })
})
