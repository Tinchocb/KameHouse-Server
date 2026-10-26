import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { resolveBackdropTreatment, heroScrimBackground } from "./media-hero"

/**
 * Settings → Apariencia → Página de Detalle → Tipo de Banner.
 *
 * The "-when-unavailable" branch can't be exercised against a library whose
 * media all have banner art, so the full matrix is pinned here.
 */
describe("resolveBackdropTreatment", () => {
    it("leaves the backdrop alone by default", () => {
        expect(resolveBackdropTreatment("default", true)).toBe("show")
        expect(resolveBackdropTreatment("default", false)).toBe("show")
    })

    it("applies the unconditional treatments regardless of banner art", () => {
        expect(resolveBackdropTreatment("blur", true)).toBe("blur")
        expect(resolveBackdropTreatment("blur", false)).toBe("blur")
        expect(resolveBackdropTreatment("dim", true)).toBe("dim")
        expect(resolveBackdropTreatment("dim", false)).toBe("dim")
        expect(resolveBackdropTreatment("hide", true)).toBe("hide")
        expect(resolveBackdropTreatment("hide", false)).toBe("hide")
    })

    it("only treats media that lack banner art for the -when-unavailable variants", () => {
        // With real banner art, these must be no-ops.
        expect(resolveBackdropTreatment("blur-when-unavailable", true)).toBe("show")
        expect(resolveBackdropTreatment("dim-when-unavailable", true)).toBe("show")
        expect(resolveBackdropTreatment("hide-when-unavailable", true)).toBe("show")

        // Without it, the fallback image gets the treatment.
        expect(resolveBackdropTreatment("blur-when-unavailable", false)).toBe("blur")
        expect(resolveBackdropTreatment("dim-when-unavailable", false)).toBe("dim")
        expect(resolveBackdropTreatment("hide-when-unavailable", false)).toBe("hide")
    })

    it("falls back to showing the backdrop for unknown or empty values", () => {
        // Legacy/unset values must not blank out someone's hero.
        expect(resolveBackdropTreatment("", true)).toBe("show")
        expect(resolveBackdropTreatment("garbage", false)).toBe("show")
    })
})

// La sinopsis y el pie de la ficha usan el texto del tema (sobre un fondo de token), no blanco fijo.
describe("MediaHero · texto de sinopsis y pie", () => {
    const source = readFileSync(join(__dirname, "media-hero.tsx"), "utf8")

    it("sinopsis y pie usan text-on-surface en vez de text-white", () => {
        expect(source).toMatch(/text-on-surface\/90/)
        expect(source).toMatch(/text-on-surface\/85/)
        expect(source).not.toMatch(/text-white\/(90|85)/)
    })
})

describe("heroScrimBackground", () => {
    it("generates standard bottom dissolve to var(--bg-primary) when fullHeight is false", () => {
        const scrim = heroScrimBackground(null, false, false)
        expect(scrim).toContain("linear-gradient(to top, var(--bg-primary) 0%")
        expect(scrim).toContain("linear-gradient(to bottom")
        expect(scrim).toContain("linear-gradient(to right")
    })

    it("generates a gentle protective bottom gradient without solid var(--bg-primary) when fullHeight is true", () => {
        const scrim = heroScrimBackground(null, false, true)
        expect(scrim).not.toContain("var(--bg-primary) 0%")
        expect(scrim).toContain("linear-gradient(to top")
        expect(scrim).toContain("transparent 48%")
    })

    it("incorporates textZoneColor tint into the gradients", () => {
        const scrim = heroScrimBackground("rgb(20, 30, 40)", false, true)
        expect(scrim).toContain("rgb(20, 30, 40)")
    })
})
