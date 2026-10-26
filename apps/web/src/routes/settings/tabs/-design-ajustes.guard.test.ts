import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Este archivo lleva prefijo "-" a propósito: el router de TanStack lo ignora y no lo toma como ruta.

// El acento viene de la configuración del usuario, así que el brillo va inline,
// pero como color-mix sobre ese acento, nunca como el color crudo ni como rgba.
describe("AppearanceTab: brillo del acento en la vista previa", () => {
    const source = readFileSync(join(__dirname, "appearance-tab.tsx"), "utf8")

    it("el punto y la barra de muestra usan color-mix sobre el acento", () => {
        expect(source).toMatch(/boxShadow: `0 0 8px color-mix\(in srgb, \$\{accentColor\} 80%, transparent\)`/)
        expect(source).toMatch(/boxShadow: `0 0 6px color-mix\(in srgb, \$\{accentColor\} 80%, transparent\)`/)
    })

    it("ninguna sombra usa el acento crudo", () => {
        expect(source).not.toMatch(/boxShadow: `0 0 \dpx \$\{accentColor\}`/)
    })
})
