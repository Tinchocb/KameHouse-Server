import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// SpringSwitch pinta cada OsToggle de Ajustes. Sus colores ya salen de tokens (colors.css, :root),
// así que los fallbacks hex sobraban, y las sombras van por la escala de elevación, sin rgba a mano.
describe("SpringSwitch (Ajustes)", () => {
    const source = readFileSync(join(__dirname, "spring-switch.tsx"), "utf8")

    it("las variables de color no llevan fallback hex", () => {
        expect(source).not.toMatch(/var\(--[\w-]+,\s*#/)
    })

    it("ninguna sombra usa rgba literal", () => {
        expect(source).not.toMatch(/rgba\(/)
    })

    it("el pulgar encendido usa elevación 2 y el apagado usa elevación 1", () => {
        expect(source).toMatch(/thumb: "bg-on-primary text-brand-accent shadow-elevation-2"/)
        expect(source).toMatch(
            /"bg-\[var\(--switch-thumb-off\)\] hover:bg-\[var\(--classic-text-secondary\)\] shadow-elevation-1"/,
        )
    })
})
