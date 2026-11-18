import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// En la cabecera de Películas solo se conserva el selector de ordenamiento (ChoiceMenu con Popover).
describe("movies-filter-bar · menú de orden", () => {
    const source = readFileSync(join(__dirname, "movies-filter-bar.tsx"), "utf8")

    it("usa ChoiceMenu con Popover y no incluye buscador ni tabs de estado", () => {
        expect(source).toMatch(/import \{ Popover \}/)
        expect(source).toMatch(/SORT_OPTIONS/)
        expect(source).not.toMatch(/SegmentedControl/)
        expect(source).not.toMatch(/<input/)
    })

    it("mantiene accesibilidad con teclado y roles de menú", () => {
        expect(source).toMatch(/aria-label=\{label\}/)
        expect(source).toMatch(/aria-pressed=\{current === opt\.value\}/)
    })
})

// Ficha de película: el corazón de favorito usa el color de estado y su resplandor sale de un token.
describe("ficha de película · corazón de favorito", () => {
    const source = readFileSync(join(__dirname, "../$movieId.lazy.tsx"), "utf8")

    it("usa text-status-error y el token de resplandor, sin rose ni rgba inline", () => {
        expect(source).not.toMatch(/text-rose-500/)
        expect(source).not.toMatch(/drop-shadow-\[0_0_8px_rgba\(244,63,94/)
        expect(source).toMatch(/text-status-error \[filter:var\(--drop-shadow-favorite\)\]/)
    })
})
