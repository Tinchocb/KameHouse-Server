import { describe, it, expect } from "vitest"
import dbTitles from "./db_titles.json"

function collectTitles(node: unknown, out: string[] = []): string[] {
    if (Array.isArray(node)) {
        for (const item of node) collectTitles(item, out)
    } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
            if (key === "title" && typeof value === "string") out.push(value)
            else collectTitles(value, out)
        }
    }
    return out
}

const count = (s: string, ch: string) => s.split(ch).length - 1

describe("db_titles.json", () => {
    const titles = collectTitles(dbTitles)

    it("tiene títulos", () => {
        expect(titles.length).toBeGreaterThan(500)
    })

    // En español cada "!" y "?" lleva su signo de apertura (¡ ¿).
    it("no tiene signos de exclamación o interrogación sin apertura", () => {
        const unbalanced = titles.filter((t) => count(t, "!") > count(t, "¡") || count(t, "?") > count(t, "¿"))
        expect(unbalanced).toEqual([])
    })
})
