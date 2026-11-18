import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Los glows del listado (aura y resplandor del estante) solo se animan con tier "full". Mirar solo el
// rendimiento debe respetar el tier "subtle".
describe("series index · compuerta de los glows", () => {
    const source = readFileSync(join(__dirname, "index.lazy.tsx"), "utf8")

    it("decide allowGlowFx con useMotionTier", () => {
        expect(source).toMatch(/const allowGlowFx = useMotionTier\(\) === 'full';/)
    })

    it("ya no lo decide solo con el rendimiento", () => {
        expect(source).not.toMatch(/selectIsHeavyEffectsAllowed/)
        expect(source).not.toMatch(/isHeavyAllowed/)
    })
})
