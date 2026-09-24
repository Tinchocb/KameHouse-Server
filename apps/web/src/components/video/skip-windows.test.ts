import { describe, expect, it } from "vitest"
import {
    findIntroChapter,
    findOutroChapter,
    isIntroChapter,
    isOutroChapter,
    resolveActiveEd,
    resolveActiveOp,
    shouldAutoSkip,
    shouldAutoSkipOutro,
    type Chapter,
} from "./skip-windows"

describe("resolveActiveOp", () => {
    it("respeta datos explícitos", () => {
        const op = { startTime: 10, endTime: 100, source: "aniskip" }
        expect(resolveActiveOp(op, 1400, "TV")).toBe(op)
    })

    it("no inventa OP en películas", () => {
        expect(resolveActiveOp(undefined, 7200, "MOVIE")).toBeUndefined()
    })

    it("aplica heurística 0-85s solo si dura >10min", () => {
        expect(resolveActiveOp(undefined, 1400, "TV")).toEqual({ startTime: 0, endTime: 85, source: "heuristic" })
        expect(resolveActiveOp(undefined, 300, "TV")).toBeUndefined()
    })
})

describe("resolveActiveEd", () => {
    it("confía en marcas reales medidas", () => {
        const ed = { startTime: 1200, endTime: 1290, source: "aniskip" }
        expect(resolveActiveEd(ed, 1400, "TV")).toEqual(ed)
    })

    it("repara endTime malformado con buffer de 5s", () => {
        const ed = { startTime: 1200, endTime: 1201, source: "aniskip" }
        expect(resolveActiveEd(ed, 1400, "TV")?.endTime).toBe(1395)
    })

    it("limita placeholder hasta fin de archivo a total-5", () => {
        const ed = { startTime: 1300, endTime: 1400, source: "aniskip" }
        expect(resolveActiveEd(ed, 1400, "TV")?.endTime).toBe(1395)
    })

    it("usa heurística si el inicio cae fuera del video", () => {
        const ed = { startTime: 1500, endTime: 1600, source: "aniskip" }
        const res = resolveActiveEd(ed, 1400, "TV")
        expect(res?.source).toBe("heuristic")
        expect(res?.endTime).toBe(1395)
    })

    it("no inventa ED en películas ni videos cortos", () => {
        expect(resolveActiveEd(undefined, 7200, "MOVIE")).toBeUndefined()
        expect(resolveActiveEd(undefined, 200, "TV")).toBeUndefined()
    })
})

describe("shouldAutoSkip", () => {
    it("acepta fuentes confiables", () => {
        for (const s of ["manual", "aniskip", "chapters", "animethemes", "fpcross", "subtitle"]) {
            expect(shouldAutoSkip(s)).toBe(true)
            expect(shouldAutoSkipOutro(s)).toBe(true)
        }
    })

    it("rechaza heurística y fuentes desconocidas para auto-skip", () => {
        expect(shouldAutoSkip("heuristic")).toBe(false)
        expect(shouldAutoSkipOutro("heuristic")).toBe(false)
        expect(shouldAutoSkip("random")).toBe(false)
        expect(shouldAutoSkipOutro("random")).toBe(false)
    })
})

const chapters: Chapter[] = [
    { startTime: 0, endTime: 85, name: "Opening 1", type: "opening" },
    { startTime: 85, endTime: 1200, name: "Episodio" },
    { startTime: 1200, endTime: 1290, name: "Ending", type: "ending" },
]

describe("detección de capítulos", () => {
    it("detecta OP/ED por tipo y por nombre", () => {
        expect(isIntroChapter(chapters[0])).toBe(true)
        expect(isIntroChapter({ startTime: 0, endTime: 10, name: "OP2" })).toBe(true)
        expect(isIntroChapter(chapters[1])).toBe(false)
        expect(isOutroChapter(chapters[2])).toBe(true)
        expect(isOutroChapter({ startTime: 0, endTime: 10, name: "Créditos finales" })).toBe(true)
        expect(isOutroChapter(chapters[1])).toBe(false)
    })

    it("encuentra el primer capítulo OP/ED", () => {
        expect(findIntroChapter(chapters)?.name).toBe("Opening 1")
        expect(findOutroChapter(chapters)?.name).toBe("Ending")
        expect(findIntroChapter([chapters[1]])).toBeUndefined()
    })
})
