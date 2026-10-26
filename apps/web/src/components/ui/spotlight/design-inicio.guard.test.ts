import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// El botón de play de los pósteres del hub de Inicio saca su sombra de un token (sin rgba inline).
describe("tarjetas del hub de Inicio · botón de play", () => {
    const tokens = readFileSync(join(__dirname, "../../../styles/tokens/shadows.css"), "utf8")

    it("el token de sombra del botón existe en shadows.css", () => {
        expect(tokens).toMatch(/--shadow-play-cta:/)
    })

    it("la tarjeta de película usa el token y no el rgba inline", () => {
        const source = readFileSync(join(__dirname, "spotlight-movie-card.tsx"), "utf8")
        expect(source).not.toMatch(/shadow-\[0_2px_12px_rgba/)
        expect(source).toMatch(/shadow-\[shadow:var\(--shadow-play-cta\)\]/)
    })

    it("la tarjeta de saga usa el mismo token que la de película", () => {
        const source = readFileSync(join(__dirname, "spotlight-saga-card.tsx"), "utf8")
        expect(source).not.toMatch(/shadow-\[0_2px_12px_rgba/)
        expect(source).toMatch(/shadow-\[shadow:var\(--shadow-play-cta\)\]/)
    })
})
