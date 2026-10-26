import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"

// Guard de diseño de la capa de shell y navegación: lee el código fuente de los archivos tocados
// y comprueba que las violaciones de docs/DESIGN-GUIDE.md (§2, §6.1 y §9) ya no están.

const leer = (ruta: string) => readFileSync(join(__dirname, ruta), "utf8")

const topnav = leer("app-topnav.tsx")
const nav = leer("floating-pill-nav.tsx")
const random = leer("random-play-button.tsx")
const search = leer("expandable-search.tsx")
const rail = leer("../era-rail/era-rail.tsx")
const hooks = leer("../kinetics/hooks.ts")

// Sombras con color literal (rgba o hex) en valores arbitrarios shadow-[...]. Se excluye drop-shadow-[...]:
// son filtros del logo y del rótulo de la marca, y quedan fuera de este guard.
const SOMBRA_LITERAL = /(?<![-\w])shadow-\[[^\]]*(?:rgba?\(|#[0-9a-fA-F]{3,8}\b)/

describe("sombras de los archivos de shell", () => {
    it.each([
        ["app-topnav.tsx", topnav],
        ["floating-pill-nav.tsx", nav],
        ["random-play-button.tsx", random],
        ["expandable-search.tsx", search],
        ["era-rail.tsx", rail],
    ])("%s no tiene rgba ni hex dentro de shadow-[...]", (_nombre, fuente) => {
        expect(fuente).not.toMatch(SOMBRA_LITERAL)
    })
})

describe("springs de la navegación", () => {
    it("no escribe springs inline: todo pasa por useSpringPreset", () => {
        expect(nav).not.toMatch(/type:\s*"spring"/)
        expect(random).not.toMatch(/type:\s*"spring"/)
    })

    it("las islas superiores y el modal usan los presets island y selector", () => {
        expect(nav).toMatch(/useSpringPreset\("island"\)/)
        expect(random).toMatch(/useSpringPreset\("selector"\)/)
        // Marca, centro y ajustes comparten el mismo resorte.
        expect(nav.match(/transition=\{islasSuperioresSpring\}/g)).toHaveLength(3)
    })

    it("los presets island (400/30) y selector (350/26) existen en hooks.ts con sus valores", () => {
        expect(hooks).toMatch(/island:\s*\{\s*type:\s*"spring",\s*stiffness:\s*400,\s*damping:\s*30\s*\}/)
        expect(hooks).toMatch(/selector:\s*\{\s*type:\s*"spring",\s*stiffness:\s*350,\s*damping:\s*26\s*\}/)
    })
})

describe("superficies, radios y texto de los archivos de shell", () => {
    it("la barra móvil usa el vidrio canónico, sin blur ni saturación a mano", () => {
        expect(topnav).toMatch(/\bglass-frosted\b/)
        expect(topnav).toMatch(/border-\[var\(--glass-border-side\)\]/)
        expect(topnav).not.toMatch(/backdrop-blur-overlay-md|backdrop-saturate-\[/)
        expect(topnav).not.toMatch(/bg-surface-container-lowest\/80/)
    })

    it("el riel de eras no usa radios arbitrarios ni literales fuera de la escala", () => {
        expect(rail).not.toMatch(/rounded-\[/)
        expect(rail).not.toMatch(/borderRadius:\s*(22|28)\b/)
    })

    it("el contador de Mi Lista sigue el acento de la era con su par de contraste de marca, en abierto y cerrado", () => {
        // bg-brand-accent (acento de la era) + text-on-primary (contraste de marca): no un negro o blanco fijo.
        expect(nav).toMatch(/bg-brand-accent text-on-primary/)
        expect(nav).not.toMatch(/selected-fg\)\] text-\[var\(--selected-bg\)/)
        expect(nav).not.toMatch(/bg-black text-white/)
        expect(nav).not.toMatch(/\bshadow-sm\b/)
    })

    it("las tarjetas del modal son superficie de contenido, sin cajas glass a mano", () => {
        // Solo las dos tarjetas: el botón de cerrar del encabezado tiene su propio borde (fuera de este guard).
        expect(random).not.toMatch(/bg-surface-container-lowest\/60/)
        expect(random).not.toMatch(/border-t-white\/35/)
        expect(random).not.toMatch(/border border-white\/15 \[@media/)
        expect(random.match(/surface-content surface-content-row/g)).toHaveLength(2)
    })

    it("el popover del buscador usa la sombra de token de elevación", () => {
        expect(search).toMatch(/shadow-\[shadow:var\(--glass-highlight-md\),var\(--elevation-4\)\]/)
    })
})
