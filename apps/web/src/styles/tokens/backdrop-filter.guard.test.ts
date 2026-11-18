import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import postcss from "postcss"
import { describe, it, expect } from "vitest"

// Lightning CSS (objetivo Chrome >= 100) trata `backdrop-filter` y `-webkit-backdrop-filter` como la misma
// propiedad y conserva solo la última. Con el prefijado detrás, el CSS servido queda únicamente con
// `-webkit-backdrop-filter`, que Chromium/WebView2 no soporta: el blur no se aplica y el `none` de
// «Reducir transparencia» tampoco. Pasó en 38 reglas de los tres temas; este guard falla si vuelve.

const SRC = join(__dirname, "..", "..")

function hojas(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre)
        if (statSync(ruta).isDirectory()) return hojas(ruta)
        return nombre.endsWith(".css") ? [ruta] : []
    })
}

describe("backdrop-filter en el CSS fuente", () => {
    it("nunca declara -webkit-backdrop-filter después de backdrop-filter", () => {
        const pisadas: string[] = []
        for (const ruta of hojas(SRC)) {
            postcss.parse(readFileSync(ruta, "utf8")).walkRules((regla) => {
                const props = regla.nodes.flatMap((nodo) => (nodo.type === "decl" ? [nodo.prop] : []))
                if (props.lastIndexOf("-webkit-backdrop-filter") > props.lastIndexOf("backdrop-filter")
                    && props.includes("backdrop-filter")) {
                    pisadas.push(`${relative(SRC, ruta).split(sep).join("/")}: ${regla.selector}`)
                }
            })
        }
        expect(pisadas).toEqual([])
    })
})
