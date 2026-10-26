import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// tailwindcss-animate registra duration-*, ease-* y delay-* también como animation-*, y animation.css
// se carga antes que los utilitarios: `duration-fast` pisa la duración de animate-scale-in y
// animate-fade-in (--duration-base, 250 ms) y deja la entrada en 150 ms. Se fija con las mismas clases
// arbitrarias que usan detail-hero.tsx y media-hero.tsx.
const DURACION = "[animation-duration:var(--duration-base)]"
const CURVA = "[animation-timing-function:var(--ease-out)]"

// Un elemento por línea: cada className de estos archivos va en una sola línea.
function linea(source: string, clase: string) {
    return source.split("\n").find(l => l.includes(clase)) ?? ""
}

describe("entrada animate-* en la serie", () => {
    const episodios = readFileSync(join(__dirname, "premium-episode-list.tsx"), "utf8")
    const sagas = readFileSync(join(__dirname, "saga-selector.tsx"), "utf8")

    it("el botón de limpiar búsqueda fija duración y curva de animate-scale-in", () => {
        const boton = linea(episodios, "animate-scale-in")
        expect(boton).not.toBe("")
        expect(boton).toContain(DURACION)
        expect(boton).toContain(CURVA)
    })

    it("el botón de quitar filtro de sub-arco fija duración y curva de animate-fade-in", () => {
        const boton = linea(sagas, "animate-fade-in")
        expect(boton).not.toBe("")
        expect(boton).toContain(DURACION)
        expect(boton).toContain(CURVA)
    })

    it("cualquier elemento con entrada y utilitarios duration-/ease- fija duración y curva", () => {
        for (const source of [episodios, sagas]) {
            const conEntradaYMovimiento = source
                .split("\n")
                .filter(l => /animate-(?:fade|scale)-in/.test(l) && /[\s"'`](?:duration|ease)-[a-z]/.test(l))
            for (const l of conEntradaYMovimiento) {
                expect(l).toContain(DURACION)
                expect(l).toContain(CURVA)
            }
        }
    })
})
