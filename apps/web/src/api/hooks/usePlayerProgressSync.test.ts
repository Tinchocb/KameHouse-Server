import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { saveProgress, sendOnExit } = vi.hoisted(() => ({ saveProgress: vi.fn(), sendOnExit: vi.fn() }))

vi.mock("@/api/hooks/continuity.hooks", () => ({
    useUpdateContinuityWatchHistoryItem: () => ({ mutate: saveProgress }),
}))
vi.mock("@/api/hooks/continuity-pending", () => ({
    sendContinuityOnExit: sendOnExit,
}))

import { getLocalProgress } from "./continuity-local"

import { usePlayerProgressSync } from "./usePlayerProgressSync"

const baseProps = { mediaId: 7, episodeNumber: 3, filepath: "/anime/ep3.mkv", intervalMs: 15_000 }

function lastCall() {
    return saveProgress.mock.calls[saveProgress.mock.calls.length - 1]?.[0]
}

describe("usePlayerProgressSync", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        saveProgress.mockClear()
        sendOnExit.mockClear()
        localStorage.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it("saves progress on each interval tick once playback moved >= 2s", () => {
        const { result } = renderHook(() => usePlayerProgressSync(baseProps))

        act(() => {
            result.current.onProgress(100, 1400)
        })
        act(() => {
            vi.advanceTimersByTime(15_000)
        })

        expect(saveProgress).toHaveBeenCalledTimes(1)
        expect(lastCall()).toMatchObject({
            options: { mediaId: 7, episodeNumber: 3, currentTime: 100, duration: 1400 },
        })
    })

    it("skips repeated syncs when playback moved less than 2s since the last save", () => {
        const { result } = renderHook(() => usePlayerProgressSync(baseProps))

        act(() => {
            result.current.onProgress(100, 1400)
        })
        act(() => {
            vi.advanceTimersByTime(15_000)
        })
        expect(saveProgress).toHaveBeenCalledTimes(1)

        // Sin movimiento: los ticks siguientes no deben persistir de nuevo.
        act(() => {
            vi.advanceTimersByTime(30_000)
        })
        expect(saveProgress).toHaveBeenCalledTimes(1)

        // Movimiento de 1s tampoco dispara sync.
        act(() => {
            result.current.onProgress(101, 1400)
        })
        act(() => {
            vi.advanceTimersByTime(15_000)
        })
        expect(saveProgress).toHaveBeenCalledTimes(1)

        // Movimiento de >= 2s sí dispara sync.
        act(() => {
            result.current.onProgress(105, 1400)
        })
        act(() => {
            vi.advanceTimersByTime(15_000)
        })
        expect(saveProgress).toHaveBeenCalledTimes(2)
        expect(lastCall()).toMatchObject({ options: { currentTime: 105 } })
    })

    it("flushes the previous episode on episode switch and resets the new session", () => {
        const { result, rerender } = renderHook(
            ({ episodeNumber }: { episodeNumber: number }) =>
                usePlayerProgressSync({ ...baseProps, episodeNumber }),
            { initialProps: { episodeNumber: 3 } },
        )

        act(() => {
            result.current.onProgress(200, 1400)
        })

        // Cambiar de episodio: el cleanup guarda el progreso pendiente del anterior...
        act(() => {
            rerender({ episodeNumber: 4 })
        })
        expect(saveProgress).toHaveBeenCalledTimes(1)
        expect(lastCall()).toMatchObject({ options: { episodeNumber: 3, currentTime: 200 } })

        // ...y la nueva sesión arranca en 0: sin onProgress no hay saves.
        act(() => {
            vi.advanceTimersByTime(30_000)
        })
        expect(saveProgress).toHaveBeenCalledTimes(1)
    })

    it("performs a final sync on unmount when there is pending progress", () => {
        const { result, unmount } = renderHook(() => usePlayerProgressSync(baseProps))

        act(() => {
            result.current.onProgress(50, 1400)
        })
        act(() => {
            unmount()
        })

        expect(saveProgress).toHaveBeenCalledTimes(1)
        expect(lastCall()).toMatchObject({ options: { currentTime: 50 } })
    })

    it("does nothing on unmount without progress and stays idle when disabled or incomplete", () => {
        const { unmount } = renderHook(() => usePlayerProgressSync(baseProps))
        act(() => {
            unmount()
        })
        expect(saveProgress).not.toHaveBeenCalled()

        renderHook(() => usePlayerProgressSync({ ...baseProps, enabled: false }))
        renderHook(() => usePlayerProgressSync({ ...baseProps, mediaId: undefined }))
        act(() => {
            vi.advanceTimersByTime(60_000)
        })
        expect(saveProgress).not.toHaveBeenCalled()
    })

    it("mirrors progress to localStorage on every onProgress", () => {
        const { result } = renderHook(() => usePlayerProgressSync(baseProps))
        act(() => {
            result.current.onProgress(321, 1400)
        })
        expect(getLocalProgress(7)).toMatchObject({ episodeNumber: 3, currentTime: 321, duration: 1400 })
    })

    it("sends with keepalive on pagehide / hidden tab and does not resend unchanged progress", () => {
        const { result } = renderHook(() => usePlayerProgressSync(baseProps))
        act(() => {
            result.current.onProgress(400, 1400)
        })
        act(() => {
            window.dispatchEvent(new Event("pagehide"))
        })
        expect(sendOnExit).toHaveBeenCalledTimes(1)
        expect(sendOnExit.mock.calls[0][0]).toMatchObject({ options: { mediaId: 7, currentTime: 400 } })

        // Ocultar la pestaña sin avanzar: nada nuevo que enviar.
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"))
        })
        expect(sendOnExit).toHaveBeenCalledTimes(1)
        expect(saveProgress).not.toHaveBeenCalled()
    })
})
