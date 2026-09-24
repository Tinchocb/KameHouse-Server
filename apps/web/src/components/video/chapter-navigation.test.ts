import { describe, expect, it } from "vitest"
import {
    findActiveChapter,
    findSkippableChapter,
    getChapterSkipKey,
    getNextChapterTarget,
    getPrevChapterTarget,
} from "./chapter-navigation"
import type { Chapter } from "./skip-windows"

const chapters: Chapter[] = [
    { startTime: 0, endTime: 85, name: "Opening 1", type: "opening" },
    { startTime: 85, endTime: 600, name: "Episodio" },
    { startTime: 600, endTime: 660, name: "Eyecatch" },
    { startTime: 660, endTime: 1200, name: "Episodio" },
    { startTime: 1200, endTime: 1290, name: "Ending", type: "ending" },
]

const PREFS = { autoSkipIntroPref: true, autoSkipOutroPref: true }

describe("findActiveChapter", () => {
    it("devuelve el capítulo bajo el cursor", () => {
        expect(findActiveChapter(chapters, 10)?.name).toBe("Opening 1")
        expect(findActiveChapter(chapters, 300)?.name).toBe("Episodio")
        expect(findActiveChapter(chapters, 1250)?.name).toBe("Ending")
    })

    it("devuelve null fuera de capítulos", () => {
        expect(findActiveChapter(chapters, 1400)).toBeNull()
        expect(findActiveChapter([], 10)).toBeNull()
    })
})

describe("getNextChapterTarget", () => {
    it("salta al siguiente inicio con ventana de 0.5s", () => {
        expect(getNextChapterTarget(chapters, 10)).toBe(85)
        expect(getNextChapterTarget(chapters, 84.8)).toBe(600)
    })

    it("devuelve null si no hay siguiente", () => {
        expect(getNextChapterTarget(chapters, 1250)).toBeNull()
    })
})

describe("getPrevChapterTarget", () => {
    it("retrocede con histéresis de 1.5s", () => {
        expect(getPrevChapterTarget(chapters, 700)).toBe(660)
        expect(getPrevChapterTarget(chapters, 90)).toBe(85)
    })

    it("devuelve 0 al inicio", () => {
        expect(getPrevChapterTarget(chapters, 10)).toBe(0)
    })
})

describe("findSkippableChapter", () => {
    it("encuentra OP/ED según preferencias", () => {
        expect(findSkippableChapter(chapters, 10, new Set(), PREFS)?.name).toBe("Opening 1")
        expect(findSkippableChapter(chapters, 10, new Set(), { ...PREFS, autoSkipIntroPref: false })).toBeNull()
        expect(findSkippableChapter(chapters, 1250, new Set(), PREFS)?.name).toBe("Ending")
    })

    it("encuentra intermedios por palabra clave y respeta los ya saltados", () => {
        expect(findSkippableChapter(chapters, 610, new Set(), PREFS)?.name).toBe("Eyecatch")
        const skipped = new Set([getChapterSkipKey(chapters[2])])
        expect(findSkippableChapter(chapters, 610, skipped, PREFS)).toBeNull()
    })

    it("ignora capítulos normales y respeta la ventana de 0.5s al final", () => {
        expect(findSkippableChapter(chapters, 300, new Set(), PREFS)).toBeNull()
        expect(findSkippableChapter(chapters, 659.8, new Set(), PREFS)).toBeNull()
    })
})
