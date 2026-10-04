import { describe, it, expect } from "vitest"
import { normalizeSafe } from "./path"

describe("normalizeSafe", () => {
    it("handles empty or falsy strings", () => {
        expect(normalizeSafe("")).toBe("")
    })

    it("converts Windows backslashes to forward slashes", () => {
        expect(normalizeSafe("C:\\Videos\\Anime")).toBe("C:/Videos/Anime")
        expect(normalizeSafe("path\\to\\file.txt")).toBe("path/to/file.txt")
    })

    it("collapses multiple redundant slashes", () => {
        expect(normalizeSafe("a//b///c")).toBe("a/b/c")
        expect(normalizeSafe("/media//series///dragon_ball")).toBe("/media/series/dragon_ball")
    })

    it("preserves UNC share paths", () => {
        expect(normalizeSafe("//server/share/file")).toBe("//server/share/file")
    })

    it("preserves relative prefix", () => {
        expect(normalizeSafe("./media/series")).toBe("./media/series")
    })

    it("trims trailing slashes while preserving root drive", () => {
        expect(normalizeSafe("/media/series/")).toBe("/media/series")
        expect(normalizeSafe("D:/")).toBe("D:/")
        expect(normalizeSafe("/")).toBe("/")
    })
})
