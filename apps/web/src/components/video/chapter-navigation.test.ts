import { describe, expect, it } from "vitest"
import {
    findActiveChapter,
    findSkippableChapter,
    getChapterSkipKey,
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

describe("findSkippableChapter", () => {
    it("con skipIntermediates salta el resumen sin auto-salto de intro, y el OP sigue su preferencia", () => {
        const prefs = { autoSkipIntroPref: false, autoSkipOutroPref: false, skipIntermediates: true }
        expect(findSkippableChapter(chapters, 620, new Set(), prefs)?.name).toBe("Eyecatch")
        expect(findSkippableChapter(chapters, 10, new Set(), prefs)).toBeNull()
    })

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
