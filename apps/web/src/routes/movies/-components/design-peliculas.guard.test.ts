import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Los chips de estado de Películas son un SegmentedControl (radiogroup con pill y roving tabindex),
// no botones con aria-pressed armados a mano.
describe("movies-filter-bar · filtro de estado", () => {
    const source = readFileSync(join(__dirname, "movies-filter-bar.tsx"), "utf8")

    it("usa SegmentedControl y no botones con aria-pressed", () => {
        expect(source).toMatch(/import \{ SegmentedControl/)
        expect(source).toMatch(/<SegmentedControl<MovieStatus>/)
        expect(source).not.toMatch(/aria-pressed=\{active\}/)
        expect(source).not.toMatch(/role="group" aria-label="Filtrar por estado"/)
    })

    it("conserva el nombre del grupo, el id del indicador y el estilo de texto", () => {
        expect(source).toMatch(/aria-label="Filtrar por estado"/)
        expect(source).toMatch(/layoutId="movies-status-indicator"/)
        expect(source).toMatch(/labelStyle="sentence"/)
        expect(source).toMatch(/surface="glass"/)
    })

    it("cada opción lleva su conteo y su nombre accesible con el número", () => {
        expect(source).toMatch(/count: statusCounts\[opt\.value\]/)
        expect(source).toMatch(/ariaLabel: `\$\{opt\.label\}: \$\{statusCounts\[opt\.value\]\}`/)
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
