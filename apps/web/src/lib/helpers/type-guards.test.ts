import { describe, it, expect } from "vitest"
import { isTmdbId } from "./type-guards"

describe("type-guards helper", () => {
    describe("isTmdbId", () => {
        it("identifies TMDB IDs based on KameHouse convention (>= 1,000,000)", () => {
            expect(isTmdbId(1000000)).toBe(true)
            expect(isTmdbId(1012609)).toBe(true)
            expect(isTmdbId(2500000)).toBe(true)
        })

        it("returns false for regular internal IDs (< 1,000,000)", () => {
            expect(isTmdbId(1)).toBe(false)
            expect(isTmdbId(999999)).toBe(false)
            expect(isTmdbId(0)).toBe(false)
            expect(isTmdbId(-1)).toBe(false)
        })

        it("returns false for null or undefined", () => {
            expect(isTmdbId(null)).toBe(false)
            expect(isTmdbId(undefined)).toBe(false)
        })
    })
})
