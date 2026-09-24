import { describe, it, expect } from "vitest"
import { stripHtml } from "./sanitizer"

describe("sanitizer helper", () => {
    describe("stripHtml", () => {
        it("removes HTML tags from strings", () => {
            expect(stripHtml("<p>Hello <b>World</b>!</p>")).toBe("Hello World!")
            expect(stripHtml("<span class=\"badge\">New</span>")).toBe("New")
            expect(stripHtml("<a href=\"/series/1\">Link</a>")).toBe("Link")
        })

        it("trims whitespace around results", () => {
            expect(stripHtml("  <div>  Content  </div>  ")).toBe("Content")
        })

        it("handles null, undefined, and empty strings safely", () => {
            expect(stripHtml(null)).toBe("")
            expect(stripHtml(undefined)).toBe("")
            expect(stripHtml("")).toBe("")
        })
    })
})
