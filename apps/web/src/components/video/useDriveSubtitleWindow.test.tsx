import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

const buildApiQuery = vi.fn()
vi.mock("@/api/client/requests", async () => {
    const actual = await vi.importActual<typeof import("@/api/client/requests")>("@/api/client/requests")
    return { ...actual, buildApiQuery: (...args: unknown[]) => buildApiQuery(...args) }
})

import { ApiError } from "@/api/client/requests"
import { useSubtitleLoadStore } from "./subtitle-load-store"
import { useDriveSubtitleWindow } from "./useDriveSubtitleWindow"
import type { DriveWindowResponse } from "./drive-subtitles"

const PATH = "gdrive://abc123/Serie/ep01.mkv"

function makeVideo(time = 0) {
    const video = document.createElement("video")
    Object.defineProperty(video, "currentTime", { value: time, writable: true, configurable: true })
    return { current: video } as React.RefObject<HTMLVideoElement | null>
}

const res = (over: Partial<DriveWindowResponse> = {}): DriveWindowResponse => ({
    state: "ready",
    version: 1,
    coveredFrom: 0,
    coveredUntil: 150,
    percent: 5,
    ...over,
})

async function flush() {
    await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })
}

describe("useDriveSubtitleWindow", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        buildApiQuery.mockReset()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("no consulta si la pista activa no es progresiva o el archivo no es de Drive", () => {
        renderHook(() => useDriveSubtitleWindow({ videoRef: makeVideo(), path: PATH, active: false }))
        renderHook(() => useDriveSubtitleWindow({ videoRef: makeVideo(), path: "D:\\Anime\\ep.mkv", active: true }))
        expect(buildApiQuery).not.toHaveBeenCalled()
    })

    it("informa la posición al servidor y pide recargar la pista al primer dato", async () => {
        buildApiQuery.mockResolvedValue(res())
        const videoRef = makeVideo(42)
        const { result } = renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        const arg = buildApiQuery.mock.calls[0][0]
        expect(arg.method).toBe("POST")
        expect(arg.endpoint).toBe("/api/v1/drive/subtitles/window")
        expect(arg.data).toEqual({ path: PATH, position: 42 })
        expect(result.current).toBe(1)
    })

    it("sigue consultando cada pocos segundos y no recarga si lo cargado alcanza", async () => {
        buildApiQuery.mockResolvedValue(res())
        const videoRef = makeVideo(10)
        const { result } = renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()
        buildApiQuery.mockResolvedValue(res({ version: 2, coveredUntil: 200 }))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(4100)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(2)
        expect(result.current).toBe(1)
    })

    it("tras un salto informa la posición nueva enseguida y recarga cuando el servidor la cubre", async () => {
        buildApiQuery.mockResolvedValue(res())
        const videoRef = makeVideo(10)
        const { result } = renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()

        ;(videoRef.current as HTMLVideoElement).currentTime = 900
        buildApiQuery.mockResolvedValue(res({ version: 3, coveredFrom: -1, coveredUntil: -1, state: "loading" }))
        act(() => {
            videoRef.current?.dispatchEvent(new Event("seeked"))
        })
        await flush()
        expect(buildApiQuery.mock.calls.at(-1)?.[0].data.position).toBe(900)
        expect(result.current).toBe(1) // todavía sin datos de ese tramo

        buildApiQuery.mockResolvedValue(res({ version: 4, coveredFrom: 840, coveredUntil: 990 }))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1100)
        })
        expect(result.current).toBe(2)
    })

    it("deja de consultar cuando el archivo entero ya está cargado", async () => {
        buildApiQuery.mockResolvedValue(res({ state: "complete", coveredUntil: 1e12 }))
        const videoRef = makeVideo()
        renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20000)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
    })

    it("un error de red no rompe nada y se reintenta", async () => {
        buildApiQuery.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(res())
        const videoRef = makeVideo()
        const { result } = renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()
        expect(result.current).toBe(0)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5100)
        })
        expect(result.current).toBe(1)
    })

    it("al desmontar corta las consultas", async () => {
        buildApiQuery.mockResolvedValue(res())
        const videoRef = makeVideo()
        const { unmount } = renderHook(() => useDriveSubtitleWindow({ videoRef, path: PATH, active: true }))
        await flush()
        unmount()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(20000)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
    })

    it("una falla de lectura del servidor se muestra en el panel (no se calla)", async () => {
        buildApiQuery.mockResolvedValue(res({ state: "error", errorKind: "rate", errorMessage: "Google Drive limitó el ritmo de lecturas (límite de uso)", retrying: true, coveredFrom: -1, coveredUntil: -1 }))
        renderHook(() => useDriveSubtitleWindow({ videoRef: makeVideo(), path: PATH, active: true }))
        await flush()
        const info = useSubtitleLoadStore.getState().windowInfo
        expect(info?.error).toBe("Google Drive limitó el ritmo de lecturas (límite de uso): reintentando…")
        expect(info?.unsupported).toBe(false)
    })

    it("un 501 (archivo sin Cues) se informa y deja de consultar", async () => {
        buildApiQuery.mockRejectedValue(new ApiError("windowed subtitles not available for this file: no-cues", 501))
        renderHook(() => useDriveSubtitleWindow({ videoRef: makeVideo(), path: PATH, active: true }))
        await flush()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000)
        })
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        const info = useSubtitleLoadStore.getState().windowInfo
        expect(info?.unsupported).toBe(true)
        expect(info?.error).toContain("Cues")
    })

    it("un error de red deja el aviso en el panel mientras reintenta", async () => {
        buildApiQuery.mockRejectedValue(new Error("offline"))
        renderHook(() => useDriveSubtitleWindow({ videoRef: makeVideo(), path: PATH, active: true }))
        await flush()
        expect(useSubtitleLoadStore.getState().windowInfo?.error).toContain("reintentando")
    })
})
