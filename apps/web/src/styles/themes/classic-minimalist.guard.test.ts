import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

const scope = '[data-ui-style="classic-minimalist"]:not([data-tv="true"])'
const dirPath = join(__dirname, "classic-minimalist")
const tokensFile = "tokens.css"

function loadThemeFiles() {
    const files = new Map<string, string>([["classic-minimalist.css", readFileSync(join(__dirname, "classic-minimalist.css"), "utf8")]])
    if (existsSync(dirPath)) {
        for (const file of readdirSync(dirPath)) {
            if (file.endsWith(".css")) files.set(file, readFileSync(join(dirPath, file), "utf8"))
        }
    }
    return files
}

const files = loadThemeFiles()
const css = postcss.parse([...files.values()].join("\n"))
const tokensSource = files.get(tokensFile) ?? ""
const definedTokens = new Set([...tokensSource.matchAll(/(--minimal-[a-z0-9-]+)\s*:/g)].map(match => match[1]))

describe("classic-minimalist · aislamiento y transparencia", () => {
    it("limita todas las reglas al tema y excluye data-tv", () => {
        css.walkRules(rule => {
            for (const selector of rule.selectors) expect(selector.startsWith(scope), selector).toBe(true)
        })
    })

    // Plano: Minimalista activa data-flat (motivo "theme") y blur.css anula todo backdrop-filter. El tema
    // no declara ninguno; un blur propio volvería a desenfocar y un `-webkit-` se perdería en el build.
    it("no declara backdrop-filter: el plano lo resuelve data-flat", () => {
        css.walkDecls(/backdrop-filter$/, decl => {
            expect.fail(`${decl.parent && "selector" in decl.parent ? decl.parent.selector : ""} { ${decl.prop}: ${decl.value} }`)
        })
    })

    it("mantiene las variantes visuales fuera de los componentes", () => {
        const sourceRoot = join(__dirname, "../..")
        const sources = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
        for (const file of sources.filter(file => /\.tsx?$/.test(file) && !file.includes(".test."))) {
            const source = readFileSync(join(sourceRoot, file), "utf8")
            expect(source, file).not.toMatch(/\[\[data-ui-style=classic-minimalist\]/)
        }
    }, 45000)
})

describe("classic-minimalist · tokens globales", () => {
    it("deja los colores literales solo en tokens.css", () => {
        const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i
        for (const [file, source] of files) {
            if (file === tokensFile) continue
            postcss.parse(source).walkDecls(decl => {
                expect(literal.test(decl.value), `${file} → ${decl.parent && "selector" in decl.parent ? decl.parent.selector : ""} { ${decl.prop}: ${decl.value} }`).toBe(false)
            })
        }
    })

    it("define cada --minimal-* que usa el tema", () => {
        const consumers = [...files.values()]
        const missing = new Set<string>()
        for (const source of consumers) {
            for (const [, name] of source.matchAll(/var\(\s*(--minimal-[a-z0-9-]+)/g)) {
                if (!definedTokens.has(name)) missing.add(name)
            }
        }
        expect([...missing]).toEqual([])
    })

    it("reserva las primitivas a tokens.css", () => {
        const primitive = /var\(\s*--minimal-(?:gray-\d|pearl|white)\b/
        for (const [file, source] of files) {
            if (file === tokensFile) continue
            postcss.parse(source).walkDecls(decl => {
                expect(primitive.test(decl.value), `${file} → ${decl.prop}: ${decl.value}`).toBe(false)
            })
        }
    })

    it("reasigna la rampa global también con transparencia reducida", () => {
        const assigned = (selector: string) => {
            const props = new Map<string, string>()
            css.walkRules(rule => {
                if (rule.selector === selector) rule.walkDecls(decl => { props.set(decl.prop, decl.value) })
            })
            return props
        }
        for (const selector of [scope, `${scope}[data-flat="true"]`]) {
            const props = assigned(selector)
            expect(props.get("--neutral-elev-0"), selector).toBe("var(--minimal-canvas)")
            expect(props.get("--neutral-elev-1"), selector).toBe("var(--minimal-surface)")
            expect(props.get("--neutral-elev-2"), selector).toBe("var(--minimal-surface-raised)")
            expect(props.get("--neutral-elev-3"), selector).toBe("var(--minimal-surface-hover)")
            expect(props.get("--neutral-separator"), selector).toBe("var(--minimal-line-2)")
        }
        expect(assigned(scope).get("--label-2")).toBe("var(--minimal-text-2)")
        expect(assigned(scope).get("--flat-1")).toBe("var(--minimal-surface)")
    })
})

describe("classic-minimalist · contrato (docs/TEMA-MINIMALISTA.md)", () => {
    const themeDecls = (prop: RegExp, visit: (file: string, value: string, where: string) => void) => {
        for (const [file, source] of files) {
            if (file === tokensFile) continue
            postcss.parse(source).walkDecls(prop, decl => {
                const where = `${file} → ${decl.parent && "selector" in decl.parent ? decl.parent.selector : ""} { ${decl.prop}: ${decl.value} }`
                visit(file, decl.value, where)
            })
        }
    }

    it("monocromo: los semánticos --minimal-* no llevan color de saturación propia", () => {
        const root = postcss.parse(tokensSource).nodes.find((node): node is postcss.Rule => node.type === "rule" && node.selector === scope)
        expect(root).toBeDefined()
        const chromatic: string[] = []
        root?.walkDecls(/^--minimal-/, decl => {
            for (const [hex] of decl.value.matchAll(/#[0-9a-f]{6}\b/gi)) {
                const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
                if (Math.max(r, g, b) - Math.min(r, g, b) > 8) chromatic.push(`${decl.prop}: ${decl.value}`)
            }
            for (const [, channels] of decl.value.matchAll(/rgba?\(([^)]*)\)/g)) {
                const [r, g, b] = channels.split(",").slice(0, 3).map(Number)
                if (Math.max(r, g, b) - Math.min(r, g, b) > 8) chromatic.push(`${decl.prop}: ${decl.value}`)
            }
        })
        expect(chromatic).toEqual([])
    })

    it("texto: solo los cuatro tamaños y los dos pesos del tema, sin mayúsculas forzadas", () => {
        themeDecls(/^font-size$/, (_, value, where) => expect(value, where).toMatch(/^var\(--minimal-font-(xs|sm|md|lg)\)$/))
        themeDecls(/^font-weight$/, (_, value, where) => expect(value, where).toMatch(/^var\(--minimal-weight-(medium|semibold)\)$/))
        themeDecls(/^text-transform$/, (_, value, where) => expect(value, where).toBe("none"))
    })

    it("radios: solo la escala del tema", () => {
        themeDecls(/^border-radius$/, (_, value, where) => expect(value, where).toMatch(/^(0|var\(--minimal-radius-(xs|sm|md|lg|pill)\))$/))
    })
})
