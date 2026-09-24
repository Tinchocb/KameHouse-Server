import { describe, it, expect } from "vitest"
import { cleanMediaTitle, getFormatLabel, getSeriesName } from "./media"

describe("media helper", () => {
    describe("cleanMediaTitle", () => {
        it("removes video extensions", () => {
            expect(cleanMediaTitle("Episodio 01.mkv")).toBe("Episodio 01")
            expect(cleanMediaTitle("Pelicula.mp4")).toBe("Pelicula")
            expect(cleanMediaTitle("Clip.avi")).toBe("Clip")
            expect(cleanMediaTitle("Sample.m4v")).toBe("Sample")
            expect(cleanMediaTitle("Teaser.mov")).toBe("Teaser")
        })

        it("removes brackets and parentheses with release group or resolution tags", () => {
            expect(cleanMediaTitle("[Erai-raws] Dragon Ball Z - 001 [1080p].mkv")).toBe("Dragon Ball Z - 001")
            expect(cleanMediaTitle("Dragon Ball Super (2015) - 131 (Dual Audio).mp4")).toBe("Dragon Ball Super - 131")
        })

        it("removes guillemets often found in episode titles", () => {
            expect(cleanMediaTitle("«¡El renacer del dragón!»")).toBe("¡El renacer del dragón!")
        })

        it("strips common movie series prefixes when isMovie is true", () => {
            expect(cleanMediaTitle("Dragon Ball Z: El poder invencible", true)).toBe("El poder invencible")
            expect(cleanMediaTitle("Dragon Ball GT - 100 años después", true)).toBe("100 años después")
            expect(cleanMediaTitle("Dragon Ball: La leyenda del dragón Shenlong", true)).toBe("La leyenda del dragón Shenlong")
        })

        it("nicely capitalizes all-uppercase titles without breaking Spanish articles", () => {
            expect(cleanMediaTitle("LA PRINCESA DURMIENTE EN EL CASTILLO DEL MAL")).toBe(
                "La Princesa Durmiente en el Castillo del Mal",
            )
            expect(cleanMediaTitle("EL COMBATE DEFINITIVO: BIO-BROLY")).toBe(
                "El Combate Definitivo: Bio-Broly",
            )
        })

        it("returns empty string when input is undefined or empty", () => {
            expect(cleanMediaTitle(undefined)).toBe("")
            expect(cleanMediaTitle("")).toBe("")
        })
    })

    describe("getSeriesName", () => {
        it("extracts series name before colon if present", () => {
            expect(getSeriesName("Dragon Ball Z: La Batalla de los Dioses")).toBe("Dragon Ball Z")
        })

        it("matches dragon ball prefix with series subtype", () => {
            expect(getSeriesName("Dragon Ball Super 131")).toBe("Dragon Ball Super")
            expect(getSeriesName("Dragon Ball GT 064")).toBe("Dragon Ball GT")
            expect(getSeriesName("Dragon Ball Kai 01")).toBe("Dragon Ball Kai")
            expect(getSeriesName("Dragon Ball Z 291")).toBe("Dragon Ball Z")
            expect(getSeriesName("Dragon Ball 153")).toBe("Dragon Ball")
        })

        it("falls back to full title when no prefix or colon matches", () => {
            expect(getSeriesName("One Piece")).toBe("One Piece")
        })

        it("returns empty string when input is undefined or empty", () => {
            expect(getSeriesName(undefined)).toBe("")
            expect(getSeriesName("")).toBe("")
        })
    })

    describe("getFormatLabel", () => {
        it("traduce los formatos conocidos y respeta los desconocidos", () => {
            expect(getFormatLabel("MOVIE")).toBe("Película")
            expect(getFormatLabel("tv")).toBe("Serie")
            expect(getFormatLabel("CUSTOM")).toBe("CUSTOM")
            expect(getFormatLabel(undefined, "Película")).toBe("Película")
        })
    })
})
