import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Maratón, Aleatorio y Música de fondo son funciones para el usuario. Estuvieron
// dentro de `import.meta.env.DEV` (24/09) y desaparecieron de la app compilada y del
// escritorio empaquetado sin que nadie lo notara, porque en desarrollo se veían bien.
describe("floating-pill-nav", () => {
    const source = readFileSync(join(__dirname, "floating-pill-nav.tsx"), "utf8")

    it("no condiciona las acciones rápidas al entorno de desarrollo", () => {
        expect(source).not.toMatch(/import\.meta\.env\.DEV/)
        expect(source).not.toMatch(/process\.env\.NODE_ENV/)
    })

    it("mantiene los tres botones con su nombre accesible", () => {
        expect(source).toMatch(/Activar Maratón/)
        expect(source).toMatch(/Reproducción Aleatoria \(Modo TV\)/)
        expect(source).toMatch(/Activar Música de Fondo/)
        expect(source).toMatch(/aria-label="Acciones rápidas"/)
    })
})
