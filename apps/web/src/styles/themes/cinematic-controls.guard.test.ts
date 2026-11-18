import { readFileSync } from "node:fs"
import { join } from "node:path"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

const css = postcss.parse(readFileSync(join(__dirname, "cinematic-controls.css"), "utf8"))

describe("controles de Neutro y Por era", () => {
    it("aísla todas las recetas y estados de Minimalista y TV", () => {
        css.walkRules(rule => {
            for (const selector of rule.selectors) {
                expect(selector).toMatch(/^:root:is\(\[data-mode="classic"\], \[data-mode="era"\]\)/)
                expect(selector).toContain(':not([data-ui-style="classic-minimalist"])')
                expect(selector).toContain(':not([data-tv="true"])')
            }
        })
    })

    it("reutiliza el vidrio existente sin agregar capas de desenfoque", () => {
        css.walkDecls(/backdrop-filter$/, decl => {
            expect.fail(`Capa adicional de vidrio: ${decl.toString()}`)
        })
    })
})
