import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, it, expect } from "vitest"

// Un var(--ease-*) o var(--duration-*) sin definir invalida la declaración `transition` entera en tiempo de
// cálculo: la duración queda en 0 s y el cambio se corta de golpe. La estantería de Series usaba
// var(--ease-out-strong), que solo existe como clase de Tailwind (apunta a --ease-out), y el texto, el
// personaje y la pose de cada lomo cambiaban sin fundirse. Este guard falla si vuelve a pasar.

const SRC = join(__dirname, "..", "..")
const CODE_FILE = /\.(ts|tsx|js|jsx|css)$/
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/
const DEFINICION = /(--(?:ease|duration)-[a-z0-9-]+)\s*:/g
// Sin respaldo: var(--ease-x) o var(--ease-x ) pero no var(--ease-x, valor).
const USO = /var\(\s*(--(?:ease|duration)-[a-z0-9-]+)\s*\)/g

function archivosDeCodigo(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre)
        if (statSync(ruta).isDirectory()) return archivosDeCodigo(ruta)
        return CODE_FILE.test(nombre) && !TEST_FILE.test(nombre) ? [ruta] : []
    })
}

function sinComentarios(fuente: string): string {
    return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1")
}

describe("variables de movimiento (--ease-*, --duration-*)", () => {
    const archivos = archivosDeCodigo(SRC)
    const fuentes = archivos.map((ruta) => ({ ruta, texto: sinComentarios(readFileSync(ruta, "utf8")) }))

    const definidas = new Set<string>()
    for (const { ruta, texto } of fuentes) {
        if (!ruta.endsWith(".css")) continue
        for (const m of texto.matchAll(DEFINICION)) definidas.add(m[1])
    }

    it("el escaneo encuentra las variables definidas en los tokens", () => {
        expect(definidas.has("--ease-out")).toBe(true)
        expect(definidas.has("--duration-base")).toBe(true)
    })

    it("toda variable usada sin respaldo está definida en algún CSS", () => {
        const sinDefinir: string[] = []
        for (const { ruta, texto } of fuentes) {
            for (const m of texto.matchAll(USO)) {
                if (!definidas.has(m[1])) sinDefinir.push(`${relative(SRC, ruta).split(sep).join("/")}: ${m[1]}`)
            }
        }
        expect(sinDefinir).toEqual([])
    })
})
