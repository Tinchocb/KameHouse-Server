import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Los chips de metadatos no llevan sombras con rgba literal: el brillo sale de shadow-glass-highlight-*
// y los halos de estado de tokens --glow-chip-*.
describe("media-metadata-capsule · sombras", () => {
    const source = readFileSync(join(__dirname, "media-metadata-capsule.tsx"), "utf8")
    const tokens = readFileSync(join(__dirname, "../../styles/tokens/shadows.css"), "utf8")

    it("ninguna sombra de chip escribe rgba literal ni inset a mano", () => {
        expect(source).not.toMatch(/shadow-\[[^\]]*rgba\(/)
        expect(source).not.toMatch(/shadow-\[inset/)
    })

    it("los halos de estado salen de los tokens de chip", () => {
        expect(source).toMatch(/shadow-\[shadow:var\(--glow-chip-success\)\]/)
        expect(source).toMatch(/shadow-\[shadow:var\(--glow-chip-warning\)\]/)
        expect(source).toMatch(/shadow-\[shadow:var\(--glow-chip-accent\)\]/)
        expect(tokens).toMatch(/--glow-chip-success:/)
        expect(tokens).toMatch(/--glow-chip-warning:/)
        expect(tokens).toMatch(/--glow-chip-accent:/)
    })
})
