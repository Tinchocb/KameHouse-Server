import { describe, it, expect } from "vitest"
import { formatDistanceToNowSafe, normalizeDate } from "./date"

describe("date helper", () => {
    describe("formatDistanceToNowSafe", () => {
        it("should format a valid date string", () => {
            const date = new Date()
            date.setFullYear(date.getFullYear() - 1)
            const result = formatDistanceToNowSafe(date.toISOString())
            expect(result).toMatch(/1 year ago|about 1 year ago/)
        })

        it("should return N/A for an invalid date string", () => {
            const result = formatDistanceToNowSafe("invalid-date")
            expect(result).toBe("N/A")
        })
    })

    describe("normalizeDate", () => {
        it("should normalize a date string with separators", () => {
            const result = normalizeDate("2023-05-15")
            expect(result.getFullYear()).toBe(2023)
            expect(result.getMonth()).toBe(4) // May
            expect(result.getDate()).toBe(15)
        })

        it("should handle T separator in ISO string", () => {
            const result = normalizeDate("2023-05-15T12:00:00")
            expect(result.getFullYear()).toBe(2023)
            expect(result.getMonth()).toBe(4)
            expect(result.getDate()).toBe(15)
        })
    })
})
