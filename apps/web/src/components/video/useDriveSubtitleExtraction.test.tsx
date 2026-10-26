import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

const buildApiQuery = vi.fn()
vi.mock("@/api/client/requests", async () => {
    const actual = await vi.importActual<typeof import("@/api/client/requests")>("@/api/client/requests")
    return { ...actual, buildApiQuery: (...args: unknown[]) => buildApiQuery(...args) }
})

import { ApiError } from "@/api/client/requests"
import { useDriveSubtitleExtraction } from "./useDriveSubtitleExtraction"
import { useSubtitleLoadStore } from "./subtitle-load-store"

const DRIVE_PATH = "gdrive://abc123/Serie/ep01.mkv"

async function flush() {
    await act(async () => {
        await Promise.resolve()
    })
}

describe("useDriveSubtitleExtraction", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        buildApiQuery.mockReset()
        useSubtitleLoadStore.getState().reset()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("en un archivo local no publica acciones ni consulta nada", () => {
        renderHook(() => useDriveSubtitleExtraction({ path: "D:\\Anime\\ep.mkv", hasPending: false }))
        expect(useSubtitleLoadStore.getState().driveActions).toBeNull()
        expect(useSubtitleLoadStore.getState().source).toBe("local")
        expect(buildApiQuery).not.toHaveBeenCalled()
    })

    it("sin pistas pendientes publica las acciones pero no consulta el estado", () => {
        renderHook(() => useDriveSubtitleExtraction({ path: DRIVE_PATH, hasPending: false }))
        expect(useSubtitleLoadStore.getState().source).toBe("drive")
        expect(useSubtitleLoadStore.getState().driveActions).not.toBeNull()
        expect(buildApiQuery).not.toHaveBeenCalled()
    })

    it("extraer: encola, sigue el progreso y al terminar habilita pistas y fuentes", async () => {
        buildApiQuery
            .mockResolvedValueOnce({ state: "none", percent: 0 }) // poll inicial (hay pendientes)
            .mockResolvedValueOnce({ state: "queued", percent: 0 }) // POST extract
            .mockResolvedValueOnce({ state: "running", percent: 40 }) // poll 1
            .mockResolvedValueOnce({ state: "done", percent: 100, fonts: ["a.ttf"] }) // poll 2

        const { result } = renderHook(() => useDriveSubtitleExtraction({ path: DRIVE_PATH, hasPending: true }))
        await flush()
        expect(result.current.driveSubtitlesReady).toBe(false)

        await act(async () => {
            useSubtitleLoadStore.getState().driveActions?.extract()
            await Promise.resolve()
        })
        await flush()
        expect(buildApiQuery).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/api/v1/drive/subtitles/extract", method: "POST", data: { path: DRIVE_PATH } }))

        // Tras el POST se consulta el estado enseguida (poll inmediato): ya va en curso.
        await flush()
        expect(useSubtitleLoadStore.getState().drive).toMatchObject({ state: "running", percent: 40 })

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600)
        })
        expect(useSubtitleLoadStore.getState().drive.state).toBe("done")
        expect(result.current.driveSubtitlesReady).toBe(true)
        expect(result.current.driveFonts).toEqual(["a.ttf"])
    })

    it("un error del servidor se traduce y deja reintentar", async () => {
        buildApiQuery
            .mockResolvedValueOnce({ state: "none", percent: 0 })
            .mockRejectedValueOnce(new ApiError("drive file too large to extract subtitles", 413))

        const { result } = renderHook(() => useDriveSubtitleExtraction({ path: DRIVE_PATH, hasPending: true }))
        await flush()
        await act(async () => {
            useSubtitleLoadStore.getState().driveActions?.extract()
            await Promise.resolve()
        })
        await flush()

        const drive = useSubtitleLoadStore.getState().drive
        expect(drive.state).toBe("error")
        expect(drive.error).toMatch(/demasiado grande/)
        expect(result.current.driveSubtitlesReady).toBe(false)
    })

    it("cancelar avisa al servidor y vuelve al estado inicial", async () => {
        buildApiQuery.mockResolvedValue({ state: "running", percent: 10 })
        renderHook(() => useDriveSubtitleExtraction({ path: DRIVE_PATH, hasPending: true }))
        await flush()

        buildApiQuery.mockClear()
        buildApiQuery.mockResolvedValue(true)
        await act(async () => {
            useSubtitleLoadStore.getState().driveActions?.cancel()
            await Promise.resolve()
        })
        await flush()
        expect(buildApiQuery).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/api/v1/drive/subtitles/cancel", method: "POST" }))
        expect(useSubtitleLoadStore.getState().drive.state).toBe("none")
    })
})
