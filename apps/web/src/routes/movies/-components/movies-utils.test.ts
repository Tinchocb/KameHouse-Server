import { describe, expect, it } from "vitest"
import type { MovieLoreDefinition } from "@/lib/config/dragonball_movies_lore"
import { getMovieSynopsis, looksEnglish } from "./movies-utils"

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
