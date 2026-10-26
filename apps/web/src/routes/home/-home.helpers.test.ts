import { describe, expect, it } from "vitest"
import type { Models_LibraryMedia } from "@/api/generated/types"
import { cleanString, getBackdrop, getTitle } from "./home.helpers"

const media = (p: Partial<Models_LibraryMedia>) => p as Models_LibraryMedia

describe("cleanString", () => {
    it("recorta los espacios de un string con contenido", () => {
        expect(cleanString("  hola  ")).toBe("hola")
    })

    it("cualquier cosa que no sea un string, o un string vacío, da cadena vacía", () => {
        expect(cleanString(5)).toBe("")
        expect(cleanString(null)).toBe("")
        expect(cleanString(undefined)).toBe("")
        expect(cleanString("   ")).toBe("")
    })
})

describe("getTitle", () => {
    it("sin objeto da el título de respaldo", () => {
        expect(getTitle(null)).toBe("Sin título")
        expect(getTitle(undefined)).toBe("Sin título")
    })

    it("prefiere el español, luego el inglés y luego el romaji", () => {
        expect(getTitle(media({ titleSpanish: "Dragón", titleEnglish: "Dragon", titleRomaji: "Doragon" }))).toBe("Dragón")
        expect(getTitle(media({ titleSpanish: "   ", titleEnglish: "Dragon", titleRomaji: "Doragon" }))).toBe("Dragon")
        expect(getTitle(media({ titleSpanish: "", titleEnglish: null as unknown as string, titleRomaji: "Doragon" }))).toBe("Doragon")
    })

    it("si ningún título tiene contenido, da el de respaldo", () => {
        expect(getTitle(media({ titleSpanish: "", titleEnglish: "  ", titleRomaji: undefined }))).toBe("Sin título")
    })
})

describe("getBackdrop", () => {
    it("usa el banner y, si no hay, el póster", () => {
        expect(getBackdrop(media({ bannerImage: "banner.jpg", posterImage: "poster.jpg" }))).toBe("banner.jpg")
        expect(getBackdrop(media({ bannerImage: "  ", posterImage: "poster.jpg" }))).toBe("poster.jpg")
    })

    it("sin imágenes o sin objeto da cadena vacía", () => {
        expect(getBackdrop(media({ bannerImage: "", posterImage: "" }))).toBe("")
        expect(getBackdrop(null)).toBe("")
    })
})
