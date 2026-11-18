import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { HERO_ROTATION_MS, getDotEdges, getDotWindow } from "./hero-carousel-dots"

// La barra de progreso del carrusel termina en un token de texto del tema, no en blanco fijo.
describe("barra de progreso del carrusel", () => {
    const source = readFileSync(join(__dirname, "hero-carousel-dots.tsx"), "utf8")

    it("no usa #ffffff fijo en el degradado", () => {
        expect(source).not.toMatch(/#ffffff/i)
    })

    it("el degradado termina en var(--label-1) en el relleno animado y en el estático", () => {
        expect(source.match(/var\(--dot-accent\) 0%, var\(--label-1\) 100%/g)).toHaveLength(2)
    })
})

describe("HERO_ROTATION_MS", () => {
    it("uses a 5-second rotation cycle", () => {
        expect(HERO_ROTATION_MS).toBe(5000)
    })
})

describe("getDotWindow", () => {
    it("shows every dot when the total fits", () => {
        expect(getDotWindow(2, 5)).toEqual([0, 1, 2, 3, 4])
    })

    it("centers the window on the active dot", () => {
        expect(getDotWindow(9, 19)).toEqual([6, 7, 8, 9, 10, 11, 12])
    })

    it("clamps the window at both edges", () => {
        expect(getDotWindow(0, 19)).toEqual([0, 1, 2, 3, 4, 5, 6])
        expect(getDotWindow(18, 19)).toEqual([12, 13, 14, 15, 16, 17, 18])
    })

    it("keeps the mobile window inside the desktop one and always includes the active dot", () => {
        for (let active = 0; active < 19; active++) {
            const desktop = getDotWindow(active, 19, 7)
            const mobile = getDotWindow(active, 19, 5)
            expect(mobile).toContain(active)
            for (const i of mobile) expect(desktop).toContain(i)
        }
    })

    it("handles non-positive total or maxVisible gracefully", () => {
        expect(getDotWindow(0, 0)).toEqual([])
        expect(getDotWindow(0, -5)).toEqual([])
        expect(getDotWindow(0, 10, 0)).toEqual([])
        expect(getDotWindow(0, 10, -3)).toEqual([])
    })
})

describe("getDotEdges", () => {
    it("marks no edges when every dot is visible", () => {
        expect([...getDotEdges(getDotWindow(2, 5), 5)]).toEqual([])
    })

    it("only marks the side that has hidden dots behind it", () => {
        expect([...getDotEdges(getDotWindow(0, 19), 19)]).toEqual([6])
        expect([...getDotEdges(getDotWindow(18, 19), 19)]).toEqual([12])
        expect([...getDotEdges(getDotWindow(9, 19), 19)]).toEqual([6, 12])
    })

    it("never shrinks the active dot", () => {
        for (let active = 0; active < 19; active++) {
            for (const size of [5, 7]) {
                expect(getDotEdges(getDotWindow(active, 19, size), 19).has(active)).toBe(false)
            }
        }
    })

    it("handles empty window or non-positive total", () => {
        expect([...getDotEdges([], 10)]).toEqual([])
        expect([...getDotEdges([0, 1], 0)]).toEqual([])
    })
})
