import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Este archivo lleva prefijo "-" a propósito: el router de TanStack ignora esos nombres y no lo toma como ruta.

// Devuelve la línea que contiene `needle`. El guard mira solo la línea corregida,
// no el archivo entero, que puede tener otros cambios en curso.
function lineWith(source: string, needle: string): string {
    const line = source.split("\n").find((l) => l.includes(needle))
    if (!line) throw new Error(`no hay ninguna línea con ${needle}`)
    return line
}

const shadows = readFileSync(join(__dirname, "../../styles/tokens/shadows.css"), "utf8")
const index = readFileSync(join(__dirname, "index.lazy.tsx"), "utf8")
const components = readFileSync(join(__dirname, "components.tsx"), "utf8")

describe("Ajustes: sombras por token", () => {
    it("los dos tokens de brillo de Ajustes existen en shadows.css", () => {
        expect(shadows).toMatch(/--shadow-glow-status-success:/)
        expect(shadows).toMatch(/--shadow-save-bar-success:/)
    })

    it("la barra flotante en estado Guardado usa el token, sin rgba inline", () => {
        const line = lineWith(index, "border-status-success/40")
        // El prefijo shadow: es obligatorio: sin el, Tailwind no genera box-shadow para una variable.
        expect(line).toMatch(/shadow-\[shadow:var\(--shadow-save-bar-success\)\]/)
        expect(line).not.toMatch(/rgba\(/)
    })

    it("el punto de estado de OsSelect usa el token de brillo, sin rgba inline", () => {
        const line = lineWith(components, 'selected ? "bg-status-success')
        expect(line).toMatch(/shadow-\[shadow:var\(--shadow-glow-status-success\)\]/)
        expect(line).not.toMatch(/rgba\(/)
    })

    it("la cabecera de Ajustes fluye con el scroll sin quedarse sticky encima de las tarjetas", () => {
        const headerLine = lineWith(index, "<header className=")
        expect(headerLine).toContain("sectionbar-minimal")
        expect(headerLine).not.toMatch(/\bsticky\b/)
    })
})
