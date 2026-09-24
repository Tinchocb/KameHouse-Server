import { describe, expect, it, vi } from "vitest"
import type { Continuity_WatchHistoryItemResponse, Mediastream_MediaContainer } from "@/api/generated/types"
import { ApiError } from "@/api/client/requests"
import { parseContinuityItemResponse, parseMediaContainer } from "./schemas"

const item = {
    kind: "mediastream",
    filepath: "/a.mkv",
    mediaId: 7,
    episodeNumber: 3,
    currentTime: 300,
    duration: 1400,
    timeAdded: "2026-01-01T00:00:00Z",
    timeUpdated: "2026-01-01T00:00:00Z",
} as const

describe("parseContinuityItemResponse", () => {
    it("deja pasar respuestas válidas (misma referencia) y undefined", () => {
        const ok: Continuity_WatchHistoryItemResponse = { found: true, item }
        expect(parseContinuityItemResponse(ok)).toBe(ok)
        expect(parseContinuityItemResponse({ found: false, item: null })).toEqual({ found: false, item: null })
        expect(parseContinuityItemResponse(undefined)).toBeUndefined()
    })

    it("respuesta inválida = sin progreso", () => {
        vi.spyOn(console, "warn").mockImplementation(() => {})
        const bad = { found: true, item: { ...item, currentTime: Number.NaN } } as Continuity_WatchHistoryItemResponse
        expect(parseContinuityItemResponse(bad)).toEqual({ found: false, item: null })
        const bad2 = { found: true, item: { ...item, currentTime: "300" } } as unknown as Continuity_WatchHistoryItemResponse
        expect(parseContinuityItemResponse(bad2)).toEqual({ found: false, item: null })
        vi.restoreAllMocks()
    })
})

describe("parseMediaContainer", () => {
    const container: Mediastream_MediaContainer = {
        filePath: "/a.mkv",
        hash: "abc",
        streamType: "direct",
        streamUrl: "/api/v1/mediastream/direct",
        mediaInfo: null,
    }

    it("deja pasar contenedores válidos", () => {
        expect(parseMediaContainer(container)).toBe(container)
        expect(parseMediaContainer(undefined)).toBeUndefined()
    })

    it("lanza ApiError si falta streamUrl o el streamType es desconocido", () => {
        expect(() => parseMediaContainer({ ...container, streamUrl: "" })).toThrow(ApiError)
        expect(() => parseMediaContainer({ ...container, streamType: "hls" } as unknown as Mediastream_MediaContainer)).toThrow(ApiError)
    })
})
