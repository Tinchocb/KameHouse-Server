import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, it, expect } from "vitest"

// --duration-fast vale 150 ms (alias de --duration-quick), igual que la clase duration-fast
// de Tailwind. Antes valía 250 ms y los usos de 250 ms pasaron a --duration-base. Si alguien
// vuelve a escribir var(--duration-fast) en el código, las dos duraciones se separan otra vez.

const SRC = join(__dirname, "..", "..")
const WEB = join(SRC, "..")
const CODE_FILE = /\.(ts|tsx|js|jsx|css)$/
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/
const USO_DURATION_FAST = /var\(\s*--duration-fast\s*[,)]/

function archivosDeCodigo(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre)
        if (statSync(ruta).isDirectory()) return archivosDeCodigo(ruta)
        return CODE_FILE.test(nombre) && !TEST_FILE.test(nombre) ? [ruta] : []
    })
}

// Quita comentarios /* */ y //. El // solo cuenta al inicio de línea o tras un espacio, para no cortar URLs.
function sinComentarios(fuente: string): string {
    return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1")
}

describe("--duration-fast en el código", () => {
    const archivos = archivosDeCodigo(SRC)

    it("el escaneo recorre apps/web/src e incluye animation.css", () => {
        expect(archivos.length).toBeGreaterThan(10)
        expect(archivos.some((f) => f.endsWith("animation.css"))).toBe(true)
    })

    it("ningún archivo de apps/web/src usa var(--duration-fast) fuera de comentarios", () => {
        const culpables = archivos
            .filter((f) => USO_DURATION_FAST.test(sinComentarios(readFileSync(f, "utf8"))))
            .map((f) => relative(SRC, f).split(sep).join("/"))
        expect(culpables).toEqual([])
    })
})

describe("clase y variable duration-fast", () => {
    const css = readFileSync(join(SRC, "styles", "tokens", "animation.css"), "utf8")
    const tailwind = readFileSync(join(WEB, "tailwind.config.ts"), "utf8")

    it("la variable --duration-fast es alias de --duration-quick (150 ms)", () => {
        expect(css).toMatch(/--duration-quick:\s*150ms;/)
        expect(css).toMatch(/--duration-fast:\s*var\(--duration-quick\);/)
    })

    it("la clase duration-fast de Tailwind apunta a la misma variable", () => {
        expect(tailwind).toMatch(/fast:\s*"var\(--duration-quick\)"/)
    })

    it("--duration-base sigue en 250 ms para los usos que antes decían --duration-fast", () => {
        expect(css).toMatch(/--duration-base:\s*250ms;/)
    })
})
