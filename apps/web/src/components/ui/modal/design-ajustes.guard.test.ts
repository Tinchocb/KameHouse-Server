import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// La caída del modal base sale de la escala de elevación (la de un diálogo grande),
// no de un rgba escrito a mano en la clase.
describe("Modal (contenido)", () => {
    const source = readFileSync(join(__dirname, "modal.tsx"), "utf8")

    it("la sombra del contenido combina el brillo de vidrio con --elevation-5", () => {
        expect(source).toMatch(/"shadow-\[shadow:var\(--glass-highlight-lg\),var\(--elevation-5\)\]"/)
    })

    it("el archivo no tiene rgba literal", () => {
        expect(source).not.toMatch(/rgba\(/)
    })
})
