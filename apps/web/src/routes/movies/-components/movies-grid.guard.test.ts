import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Las filas de la grilla de películas son una lista que se recorre rápido: su revelado usa la
// variante "list" (solo fundido corto, sin ascenso ni escalonado), como las filas de episodios.
describe("movies-grid · revelado al bajar", () => {
    const source = readFileSync(join(__dirname, "movies-grid.tsx"), "utf8")

    it("usa la variante list en useRevealRef", () => {
        expect(source).toMatch(/useRevealRef<HTMLDivElement>\(undefined, "list"\)/)
    })

    it("sigue deduplicando cada tarjeta por su data-reveal-key", () => {
        expect(source).toMatch(/data-reveal-key=\{`movie:/)
    })
})
