import { afterEach, describe, expect, it } from "vitest"
import type { Continuity_WatchHistoryItemResponse } from "@/api/generated/types"
import { confirmLocalProgress, getLocalProgress, mergeWithLocalProgress, saveLocalProgress } from "./continuity-local"

const server = (currentTime: number, timeUpdated: string): Continuity_WatchHistoryItemResponse => ({
    found: true,
    item: {
        kind: "mediastream",
        filepath: "/a.mkv",
        mediaId: 7,
        episodeNumber: 3,
        currentTime,
        duration: 1400,
        timeAdded: timeUpdated,
        timeUpdated,
    },
})

describe("continuity-local", () => {
    afterEach(() => localStorage.clear())

    it("devuelve la misma referencia mientras no cambie", () => {
        saveLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 100, duration: 1400 })
        const a = getLocalProgress(7)
        expect(getLocalProgress(7)).toBe(a)
        saveLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 110, duration: 1400 })
        expect(getLocalProgress(7)).not.toBe(a)
    })

    it("un guardado confirmado igual o posterior borra el espejo", () => {
        saveLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 100, duration: 1400 })
        confirmLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 90 })
        expect(getLocalProgress(7)).toBeDefined()
        confirmLocalProgress({ mediaId: 7, episodeNumber: 4, currentTime: 500 })
        expect(getLocalProgress(7)).toBeDefined()
        confirmLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 100 })
        expect(getLocalProgress(7)).toBeUndefined()
    })

    it("merge: gana el más reciente", () => {
        const t0 = Date.parse("2026-01-01T00:00:00Z")
        saveLocalProgress({ mediaId: 7, episodeNumber: 3, currentTime: 600, duration: 1400 }, t0)
        const local = getLocalProgress(7)

        // Servidor más viejo → espejo local.
        expect(mergeWithLocalProgress(server(300, "2025-12-31T23:00:00Z"), local)?.item?.currentTime).toBe(600)
        // Servidor más nuevo (otro dispositivo) → servidor.
        expect(mergeWithLocalProgress(server(300, "2026-01-01T01:00:00Z"), local)?.item?.currentTime).toBe(300)
        // Query sin respuesta todavía → espejo local.
        expect(mergeWithLocalProgress(undefined, local)).toMatchObject({ found: true, item: { currentTime: 600 } })
        // Sin espejo → servidor tal cual.
        const s = server(300, "2025-12-31T23:00:00Z")
        expect(mergeWithLocalProgress(s, undefined)).toBe(s)
    })
})
