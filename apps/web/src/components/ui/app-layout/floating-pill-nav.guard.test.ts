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
        expect(source).toMatch(/aria-label="Sorpréndeme"/)
        expect(source).toMatch(/Activar música de fondo/)
        expect(source).toMatch(/aria-label="Acciones rápidas"/)
    })
})

// La barra pasa a solo íconos al bajar la página. Si el ícono queda solo, el destino
// tiene que seguir teniendo nombre, estado y una animación que no mueva el layout.
describe("barra compacta (solo íconos)", () => {
    const nav = readFileSync(join(__dirname, "floating-pill-nav.tsx"), "utf8")
    const mobile = readFileSync(join(__dirname, "app-topnav.tsx"), "utf8")
    const label = readFileSync(join(__dirname, "nav-label.tsx"), "utf8")

    it("cada destino conserva aria-label y aria-current al quedar en ícono", () => {
        expect(nav).toMatch(/aria-label=\{item\.label\}/)
        expect(nav).toMatch(/aria-current=\{isPillActive \? "page" : undefined\}/)
        expect(mobile).toMatch(/aria-label=\{item\.label\}/)
        expect(mobile).toMatch(/aria-current=\{isActive \? "page" : undefined\}/)
    })

    it("muestra un tooltip al enfocar o pasar el puntero cuando no hay etiqueta", () => {
        expect(nav).toMatch(/<NavTooltip show=\{!showLabels\}/)
        expect(label).toMatch(/group-focus-visible:opacity-100/)
        expect(label).toMatch(/group-hover:opacity-100/)
    })

    it("la píldora se reacomoda con layout de framer-motion, sin animar ancho a mano", () => {
        expect(nav).toMatch(/<m\.nav\s+layout/)
        expect(label).toMatch(/mode="popLayout"/)
        expect(nav + mobile + label).not.toMatch(/animate=\{\{[^}]*(width|height)/)
    })

    it("las etiquetas solo animan opacity y transform, y respetan reduced motion", () => {
        expect(label).toMatch(/opacity: 0/)
        expect(label).not.toMatch(/(width|height|maxWidth)\s*:/)
        expect(label).toMatch(/useReducedMotion/)
    })

    it("lo decide el hook compartido, que sigue la preferencia guardada", () => {
        expect(nav).toMatch(/useNavCompact\(\)/)
        expect(mobile).toMatch(/useNavCompact\(\)/)
    })

    it("mantiene el objetivo táctil de 44 px con puntero grueso", () => {
        expect(nav).toMatch(/\[@media\(pointer:coarse\)\]:min-h-\[44px\]/)
        expect(mobile).toMatch(/min-h-\[44px\]/)
    })

    it("la isla de la marca se compacta a solo logo con la misma señal que la barra", () => {
        // Un solo hook para ambas islas: mismo disparador, misma histéresis, se abren juntas.
        expect(nav.match(/useNavCompact\(\)/g)).toHaveLength(1)
        expect(nav).toMatch(/aria-label="KameHouse, ir al inicio"/)
        expect(nav).toMatch(/<NavLabel\s+show=\{showBrandText\}/)
        expect(nav).toMatch(/<NavTooltip show=\{!showBrandText\}>KameHouse<\/NavTooltip>/)
        const brand = nav.slice(nav.indexOf("ISLA IZQUIERDA"), nav.indexOf("ISLA CENTRAL"))
        // `layoutDependency` (opcional) evita re-medir la cápsula en renders que no cambian su geometría.
        expect(brand).toMatch(/layout\s+(?:layoutDependency=\{[^}]*\}\s+)?transition=\{layoutTransition\}/)
        expect(brand).toMatch(/\{\.\.\.engageHandlers\}/)
        expect(brand).not.toMatch(/sr-only/)
    })

    it("la isla derecha solo trae Buscar y Ajustes (sin campana ni Administración)", () => {
        const right = nav.slice(nav.indexOf("ISLA DERECHA"), nav.indexOf("ISLA FLOTANTE INFERIOR"))
        expect(right).not.toMatch(/NotificationBell/)
        expect(right).not.toMatch(/to="\/admin"/)
        // Ajustes de 32 px (44 con puntero grueso)
        expect(right.match(/h-8 w-8 \[@media\(pointer:coarse\)\]:h-11 \[@media\(pointer:coarse\)\]:w-11/g)).toHaveLength(1)
    })

    it("la barra móvil no recorta las etiquetas con elipsis", () => {
        const bottom = mobile.slice(mobile.indexOf("export const AppBottomNav"))
        expect(bottom).not.toMatch(/truncate/)
        expect(bottom).not.toMatch(/uppercase/)
    })
})

// Ritmo de las islas: el micro-feedback (hover, presión, estado activo) va en 150 ms.
describe("tiempos y formas de las islas", () => {
    const nav = readFileSync(join(__dirname, "floating-pill-nav.tsx"), "utf8")
    const mobile = readFileSync(join(__dirname, "app-topnav.tsx"), "utf8")
    const search = readFileSync(join(__dirname, "expandable-search.tsx"), "utf8")

    it("no usa la variable --duration-fast: el micro-feedback va con --duration-quick (150 ms)", () => {
        for (const source of [nav, mobile, search]) {
            expect(source).not.toMatch(/var\(--duration-fast\)/)
        }
    })

    it("la presión active:scale anima transform, no la propiedad scale", () => {
        // active:scale-* de Tailwind escribe `transform`: una transición de `scale` no lo anima.
        expect(nav).not.toMatch(/\[transition:scale_/)
    })

    it("el indicador compartido lleva el radio en style para que framer lo corrija al escalar", () => {
        const indicators = (nav + mobile).match(/<MagneticIndicator[\s\S]*?\/>/g) ?? []
        expect(indicators.length).toBeGreaterThan(0)
        for (const tag of indicators) {
            expect(tag).toMatch(/borderRadius: 9999/)
        }
    })

    it("el buscador no anima el ancho con framer", () => {
        expect(search).not.toMatch(/animate=\{\{[^}]*width/)
    })
})
