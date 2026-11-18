import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Este archivo lleva prefijo "-" a propósito: el router de TanStack lo ignora y no lo toma como ruta.

// El acento viene de la configuración del usuario, así que el brillo va inline,
// pero como color-mix sobre ese acento, nunca como el color crudo ni como rgba.
describe("AppearanceTab: ausencia de preview flotante y control de acento", () => {
    const source = readFileSync(join(__dirname, "appearance-tab.tsx"), "utf8")

    it("la vista previa redundante AppearanceThemeLivePreview está removida", () => {
        expect(source).not.toMatch(/AppearanceThemeLivePreview/)
    })

    it("la comparativa redundante TransparencyCompare está removida", () => {
        expect(source).not.toMatch(/TransparencyCompare/)
    })

    it("ninguna sombra usa el acento crudo", () => {
        expect(source).not.toMatch(/boxShadow: `0 0 \dpx \$\{accentColor\}`/)
    })
})
