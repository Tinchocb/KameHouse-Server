import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Ficha de película o serie: el póster y el logo se sombrean con tokens, no con sombras genéricas ni rgba inline.
describe("detail-hero · sombras", () => {
    const source = readFileSync(join(__dirname, "detail-hero.tsx"), "utf8")

    it("el póster usa la sombra hero y no shadow-2xl ni drop-shadow con rgba", () => {
        expect(source).not.toMatch(/shadow-2xl/)
        expect(source).not.toMatch(/drop-shadow-\[0_20px_40px_rgba/)
        expect(source).toMatch(/\bshadow-hero\b/)
    })

    it("el logo sombrea con el token de filtro en vez de rgba inline", () => {
        expect(source).not.toMatch(/drop-shadow-\[0_2px_12px_rgba/)
        expect(source).toMatch(/\[filter:var\(--drop-shadow-logo\)\]/)
    })
})
