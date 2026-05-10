import { describe, it, expect } from "vitest"
import { sanitizeHtml } from "./sanitizer"

describe("sanitizeHtml", () => {
    it("should allow safe tags", () => {
        const input = "<p>Hello <b>world</b></p>"
        expect(sanitizeHtml(input)).toBe(input)
    })

    it("should remove dangerous tags", () => {
        const input = "<p>Hello</p><script>alert('xss')</script>"
        expect(sanitizeHtml(input)).toBe("<p>Hello</p>")
    })

    it("should remove dangerous attributes", () => {
        const input = '<p onclick="alert(1)">Click me</p>'
        expect(sanitizeHtml(input)).toBe("<p>Click me</p>")
    })

    it("should allow safe links", () => {
        const input = '<a href="https://google.com">Link</a>'
        expect(sanitizeHtml(input)).toBe(input)
    })

    it("should handle null/undefined", () => {
        expect(sanitizeHtml(null)).toBe("")
        expect(sanitizeHtml(undefined)).toBe("")
    })
})
