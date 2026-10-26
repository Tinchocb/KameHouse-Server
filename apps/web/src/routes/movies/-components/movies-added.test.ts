import { describe, expect, it } from "vitest"
import { getAddedBaseline, isNewlyAdded } from "./movies-added"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-10-06T12:00:00Z")
const at = (daysAgo: number) => ({ media: { createdAt: new Date(NOW - daysAgo * DAY).toISOString() } })

describe("movies-added", () => {
    it("el baseline es el alta más antigua y ignora entradas sin fecha", () => {
        expect(getAddedBaseline([at(10), at(100), { media: {} }, null])).toBe(Date.parse(at(100).media.createdAt))
        expect(getAddedBaseline([])).toBe(0)
    })

    it("el escaneo inicial no marca nada como nuevo", () => {
        const base = getAddedBaseline([at(100), at(100)])
        expect(isNewlyAdded(at(100), base, NOW)).toBe(false)
    })

    it("marca lo añadido después del escaneo y dentro de 30 días", () => {
        const base = getAddedBaseline([at(100)])
        expect(isNewlyAdded(at(15), base, NOW)).toBe(true)
        expect(isNewlyAdded(at(45), base, NOW)).toBe(false)
    })

    it("sin fecha o sin baseline no es nuevo", () => {
        expect(isNewlyAdded({ media: {} }, 1, NOW)).toBe(false)
        expect(isNewlyAdded(at(1), 0, NOW)).toBe(false)
    })
})
