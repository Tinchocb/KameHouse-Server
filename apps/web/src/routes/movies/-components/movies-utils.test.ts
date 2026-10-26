import { describe, expect, it } from "vitest"
import type { MovieLoreDefinition } from "@/lib/config/dragonball_movies_lore"
import { getMovieSynopsis, looksEnglish, getMovieProgress, getMovieStatus, getEntryDecade, parseMoviesPrefs, gridHeading } from "./movies-utils"

const lore: MovieLoreDefinition = {
    id: "test",
    title: "Película de prueba",
    era: "dbz",
    canonStatus: "No canon",
    chronologyNotes: "Notas curadas en español.",
    specialTrivia: "Dato curioso.",
}

describe("getMovieSynopsis", () => {
    it("keeps a Spanish library description", () => {
        expect(getMovieSynopsis("Goku viaja al futuro.", lore)).toBe("Goku viaja al futuro.")
    })

    it("prefers the curated lore when the description looks English", () => {
        expect(getMovieSynopsis("After the defeat of Frieza, Goku trains.", lore)).toBe("Notas curadas en español.")
    })

    it("falls back to the lore when there is no description", () => {
        expect(getMovieSynopsis(null, lore)).toBe("Notas curadas en español.")
        expect(getMovieSynopsis("   ", lore)).toBe("Notas curadas en español.")
    })

    it("keeps the English description when there is no lore", () => {
        expect(getMovieSynopsis("The Saiyans arrive.", null)).toBe("The Saiyans arrive.")
    })

    it("strips HTML and returns an empty string when nothing is available", () => {
        expect(getMovieSynopsis("<p>Goku <b>entrena</b>.</p>", null)).toBe("Goku entrena.")
        expect(getMovieSynopsis(undefined, null)).toBe("")
    })

    it("detects English even when it starts with a character name", () => {
        expect(getMovieSynopsis("Goku and his friends must stop the Saiyans.", lore)).toBe("Notas curadas en español.")
    })
})

describe("looksEnglish", () => {
    it("classifies common TMDB synopses", () => {
        expect(looksEnglish("After the defeat of Frieza, Goku trains with his son.")).toBe(true)
        expect(looksEnglish("Goku se enfrenta a Cooler, el hermano mayor de Freezer.")).toBe(false)
        expect(looksEnglish("Tras la derrota de Freezer, Goku entrena con su hijo.")).toBe(false)
    })
})

describe('getMovieProgress / getMovieStatus', () => {
    const entry = { media: { watched: false, totalEpisodes: 1 }, listData: { progress: 0 } } as never

    it('marks 30 s or less as not started', () => {
        expect(getMovieProgress(entry, { currentTime: 20, duration: 6000 }).hasProgress).toBe(false)
        expect(getMovieStatus(entry, { currentTime: 20, duration: 6000 })).toBe('pending')
    })

    it('computes the percentage for a partial watch', () => {
        expect(getMovieProgress(entry, { currentTime: 1500, duration: 6000 })).toEqual({ isCompleted: false, hasProgress: true, progressPercent: 25 })
        expect(getMovieStatus(entry, { currentTime: 1500, duration: 6000 })).toBe('continue')
    })

    it('treats watched flag or full list progress as watched', () => {
        expect(getMovieStatus({ media: { watched: true } } as never)).toBe('watched')
        expect(getMovieStatus({ media: { totalEpisodes: 1 }, listData: { progress: 1 } } as never, { currentTime: 100, duration: 6000 })).toBe('watched')
    })

    it('ignores a finished watch (currentTime >= duration)', () => {
        expect(getMovieProgress(entry, { currentTime: 6000, duration: 6000 }).hasProgress).toBe(false)
    })
})

describe('getEntryDecade', () => {
    it('groups by decade and returns null without year', () => {
        expect(getEntryDecade({ media: { year: 1989 } } as never)).toBe(1980)
        expect(getEntryDecade({ media: { year: 2018 } } as never)).toBe(2010)
        expect(getEntryDecade({ media: { year: 0 } } as never)).toBeNull()
        expect(getEntryDecade({ media: null })).toBeNull()
    })
})

describe('parseMoviesPrefs', () => {
    it('keeps valid values and drops the rest', () => {
        expect(parseMoviesPrefs(JSON.stringify({ sort: 'year_desc', estado: 'watched', decada: 1990 }))).toEqual({ sort: 'year_desc', estado: 'watched', decada: 1990 })
        expect(parseMoviesPrefs(JSON.stringify({ sort: 'nope', estado: 'all', decada: 'x' }))).toEqual({})
    })

    it('survives empty or corrupt storage', () => {
        expect(parseMoviesPrefs(null)).toEqual({})
        expect(parseMoviesPrefs('{rota')).toEqual({})
    })
})

describe('gridHeading', () => {
    it('names the era or the whole library', () => {
        expect(gridHeading(null)).toBe('Todas las películas')
        expect(gridHeading('Dragon Ball Z')).toBe('Películas de Dragon Ball Z')
    })
})
