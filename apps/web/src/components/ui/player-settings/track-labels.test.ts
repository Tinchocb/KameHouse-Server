import { describe, expect, it } from "vitest"
import { audioTrackName, subtitleTrackName } from "./track-labels"

const NAMES: Record<string, string> = { spa: "Español", jpn: "Japonés", eng: "Inglés" }
const friendly = (lang: string) => NAMES[lang] ?? lang.toUpperCase()

describe("subtitleTrackName", () => {
    it("usa el título de la pista cuando es un nombre real", () => {
        expect(subtitleTrackName({ title: "Español (Latino)", language: "spa" }, 0, friendly)).toBe("Español (Latino)")
    })

    it("sin título muestra el idioma en texto, no el código", () => {
        expect(subtitleTrackName({ title: "", language: "spa" }, 0, friendly)).toBe("Español")
        expect(subtitleTrackName({ title: undefined, language: "jpn" }, 3, friendly)).toBe("Japonés")
        expect(subtitleTrackName({ title: null, language: "eng" }, 1, friendly)).toBe("Inglés")
    })

    it('sin título y con idioma "und" no muestra el código crudo: numera la pista', () => {
        expect(subtitleTrackName({ title: "", language: "und" }, 0, friendly)).toBe("Subtítulos 1")
        expect(subtitleTrackName({ title: "", language: "und" }, 2, friendly)).toBe("Subtítulos 3")
    })

    it("sin idioma (vacío, nulo, unknown o und con escritura) se numera igual", () => {
        expect(subtitleTrackName({ title: "", language: "" }, 0, friendly)).toBe("Subtítulos 1")
        expect(subtitleTrackName({ title: "", language: null }, 1, friendly)).toBe("Subtítulos 2")
        expect(subtitleTrackName({ title: "  ", language: "unknown" }, 2, friendly)).toBe("Subtítulos 3")
        expect(subtitleTrackName({ title: "", language: "und-Latn" }, 3, friendly)).toBe("Subtítulos 4")
    })

    it("un título que es solo el código de idioma no cuenta como nombre", () => {
        expect(subtitleTrackName({ title: "und", language: "und" }, 1, friendly)).toBe("Subtítulos 2")
        expect(subtitleTrackName({ title: "UND", language: "" }, 0, friendly)).toBe("Subtítulos 1")
        expect(subtitleTrackName({ title: "jpn", language: "jpn" }, 0, friendly)).toBe("Japonés")
        expect(subtitleTrackName({ title: " UND-Latn ", language: "" }, 0, friendly)).toBe("Subtítulos 1")
        expect(subtitleTrackName({ title: "unknown_US", language: "spa" }, 0, friendly)).toBe("Español")
    })

    it("conserva un título real aunque el idioma sea desconocido", () => {
        expect(subtitleTrackName({ title: "Signs & Songs", language: "und" }, 0, friendly)).toBe("Signs & Songs")
        expect(subtitleTrackName({ title: "- Español -", language: "und" }, 0, friendly)).toBe("- Español -")
    })
})

describe("audioTrackName", () => {
    it('audio sin título y con idioma "und" se numera como Audio N', () => {
        expect(audioTrackName({ title: "", language: "und" }, 0, friendly)).toBe("Audio 1")
        expect(audioTrackName({ title: "und", language: "und" }, 1, friendly)).toBe("Audio 2")
    })

    it("respeta el título y el idioma conocido", () => {
        expect(audioTrackName({ title: "Latino", language: "und" }, 0, friendly)).toBe("Latino")
        expect(audioTrackName({ title: "", language: "jpn" }, 0, friendly)).toBe("Japonés")
    })
})
