import { describe, expect, it } from "vitest"
import {
    findIntroChapter,
    findOutroChapter,
    isIntroChapter,
    isOutroChapter,
    resolveActiveEd,
    resolveActiveOp,
    resolveEdWindow,
    resolveOpWindow,
    resolveRecapWindow,
    shouldAutoSkip,
    shouldAutoSkipOutro,
    type Chapter,
} from "./skip-windows"

describe("resolveRecapWindow", () => {
    it("prioriza las marcas del archivo sobre AniSkip", () => {
        expect(resolveRecapWindow({ recap: { startTime: 0, endTime: 60 } }, [
            { name: "Resumen", startTime: 0, endTime: 45 },
        ])).toEqual({ startTime: 0, endTime: 45, source: "chapters" })
    })

    it("reconoce el tipo prologue aun con nombre genérico", () => {
        expect(resolveRecapWindow(undefined, [{ name: "Chapter 1", type: "prologue", startTime: 0, endTime: 45 }])?.endTime).toBe(45)
    })

    it("no inventa resumen ni admite intervalos inválidos", () => {
        expect(resolveRecapWindow(undefined, [{ name: "Episode", startTime: 0, endTime: 200 }])).toBeUndefined()
        expect(resolveRecapWindow({ recap: { startTime: 0, endTime: NaN } }, [
            { name: "Resumen", startTime: 45, endTime: 0 },
        ])).toBeUndefined()
    })
})

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

describe("resolveOpWindow", () => {
    const chapters: Chapter[] = [
        { startTime: 0, endTime: 30, name: "Prologue" },
        { startTime: 30, endTime: 120, name: "Opening 1" },
    ]

    it("prefiere AniSkip y conserva su origen", () => {
        expect(resolveOpWindow({ op: { startTime: 5, endTime: 95 }, opSource: "community" }, chapters, undefined))
            .toEqual({ startTime: 5, endTime: 95, source: "community" })
        expect(resolveOpWindow({ op: { startTime: 5, endTime: 95 } }, [], undefined))
            .toEqual({ startTime: 5, endTime: 95, source: "aniskip" })
    })

    it("una ventana heurística (copia del episodio anterior) no pisa al capítulo OP", () => {
        // El auto-salto por capítulo y el botón deben apuntar al mismo final de intro.
        const opChapters: Chapter[] = [{ startTime: 0, endTime: 80, name: "OP" }]
        expect(resolveOpWindow({ op: { startTime: 0, endTime: 90 }, opSource: "heuristic" }, opChapters, undefined))
            .toEqual({ startTime: 0, endTime: 80, source: "chapters" })
        expect(resolveOpWindow({ op: { startTime: 0, endTime: 90 }, opSource: "heuristic" }, [], undefined))
            .toEqual({ startTime: 0, endTime: 90, source: "heuristic" })
    })

    it("sin AniSkip usa el capítulo del archivo", () => {
        expect(resolveOpWindow(undefined, chapters, { opStart: 1, opEnd: 2 }))
            .toEqual({ startTime: 30, endTime: 120, source: "chapters" })
    })

    it("sin capítulo usa lo aprendido de la serie", () => {
        expect(resolveOpWindow(undefined, [], { opStart: 10, opEnd: 100 }))
            .toEqual({ startTime: 10, endTime: 100, source: "propagated" })
    })

    it("ignora una caché incompleta o ausente", () => {
        expect(resolveOpWindow(undefined, [], { opStart: 10 })).toBeUndefined()
        expect(resolveOpWindow(undefined, [], { opEnd: 100 })).toBeUndefined()
        expect(resolveOpWindow(undefined, [], undefined)).toBeUndefined()
    })

    it("acepta 0 como inicio válido de la caché", () => {
        expect(resolveOpWindow(undefined, [], { opStart: 0, opEnd: 85 }))
            .toEqual({ startTime: 0, endTime: 85, source: "propagated" })
    })
})

describe("resolveEdWindow", () => {
    const chapters: Chapter[] = [{ startTime: 1300, endTime: 1400, name: "Ending" }]

    it("prefiere AniSkip y conserva su origen", () => {
        expect(resolveEdWindow({ ed: { startTime: 1300, endTime: 1390 }, edSource: "community" }, chapters, undefined, 1400))
            .toEqual({ startTime: 1300, endTime: 1390, source: "community" })
    })

    it("si AniSkip no trae fin, termina en la duración", () => {
        expect(resolveEdWindow({ ed: { startTime: 1300, endTime: 0 } }, [], undefined, 1400))
            .toEqual({ startTime: 1300, endTime: 1400, source: "aniskip" })
        expect(resolveEdWindow({ ed: { startTime: 1300, endTime: 0 } }, [], undefined, 0))
            .toEqual({ startTime: 1300, endTime: 0, source: "aniskip" })
    })

    it("sin AniSkip usa el capítulo del archivo", () => {
        expect(resolveEdWindow(undefined, chapters, { edOffset: 1, edEnd: 2 }, 1400))
            .toEqual({ startTime: 1300, endTime: 1400, source: "chapters" })
    })

    it("sin capítulo usa la caché de la serie, con fin propio o la duración", () => {
        expect(resolveEdWindow(undefined, [], { edOffset: 1320, edEnd: 1395 }, 1400))
            .toEqual({ startTime: 1320, endTime: 1395, source: "propagated" })
        expect(resolveEdWindow(undefined, [], { edOffset: 1320 }, 1400))
            .toEqual({ startTime: 1320, endTime: 1400, source: "propagated" })
        expect(resolveEdWindow(undefined, [], { edOffset: 1320, edEnd: 0 }, 1400))
            .toEqual({ startTime: 1320, endTime: 1400, source: "propagated" })
    })

    it("la caché no vale sin duración conocida ni con offset cero", () => {
        expect(resolveEdWindow(undefined, [], { edOffset: 1320 }, 0)).toBeUndefined()
        expect(resolveEdWindow(undefined, [], { edOffset: 0 }, 1400)).toBeUndefined()
        expect(resolveEdWindow(undefined, [], undefined, 1400)).toBeUndefined()
    })
})
