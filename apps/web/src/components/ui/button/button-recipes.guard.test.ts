import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, it, expect } from "vitest"
import baseline from "./button-recipes.baseline.json"

// Ratchet: los <button> crudos con receta propia (bg-white/NN o backdrop-blur) no
// pueden crecer. Cada pantalla migrada a <Button>/<IconButton> baja su cifra en el
// baseline; subirla o sumar archivos nuevos rompe este test.
const SRC = join(__dirname, "..", "..", "..")
const OPEN_BUTTON = /<button\b[^>]*?>/gs
const RECIPE = /bg-white\/(?:\[?[\d.]+\]?)|backdrop-blur/

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full, out)
        else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(full)
    }
    return out
}

function countOffenders(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const file of walk(SRC)) {
        const matches = readFileSync(file, "utf8").match(OPEN_BUTTON) ?? []
        const n = matches.filter((tag) => RECIPE.test(tag)).length
        if (n > 0) result[relative(SRC, file).split(sep).join("/")] = n
    }
    return result
}

describe("button-recipes guard", () => {
    it("no suma <button> crudos con bg-white/NN ni backdrop-blur", () => {
        const current = countOffenders()
        const grown = Object.entries(current).filter(
            ([file, n]) => n > ((baseline as Record<string, number>)[file] ?? 0),
        )
        expect(grown).toEqual([])
    })
})
