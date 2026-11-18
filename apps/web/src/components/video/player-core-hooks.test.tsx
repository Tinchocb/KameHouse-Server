import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import { formatPlaybackTime } from "./format-playback-time"
import { usePlayerDuration } from "./usePlayerDuration"
import { usePlayerSeek, SEEK_THROTTLE_MS } from "./usePlayerSeek"

describe("formatPlaybackTime", () => {
    it("formats minutes and hours", () => {
        expect(formatPlaybackTime(0)).toBe("00:00")
        expect(formatPlaybackTime(NaN)).toBe("00:00")
        expect(formatPlaybackTime(65)).toBe("01:05")
        expect(formatPlaybackTime(1420)).toBe("23:40")
        expect(formatPlaybackTime(3725.9)).toBe("1:02:05")
    })
})

describe("usePlayerDuration", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("keeps finite durations and falls back to metadata for Infinity/NaN", () => {
        const { result } = renderHook(() => usePlayerDuration(1400))

        act(() => result.current.setDuration(1420))
        expect(result.current.duration).toBe(1420)

        act(() => result.current.setDuration(Infinity))
        expect(result.current.duration).toBe(1400)
    })

    it("keeps the previous value when neither source is usable", () => {
        const { result } = renderHook(() => usePlayerDuration(undefined))
        act(() => result.current.setDuration(900))
        act(() => result.current.setDuration(NaN))
        expect(result.current.duration).toBe(900)
    })

    it("seeds from metadata when the browser never reports a duration", () => {
        const { result } = renderHook(() => usePlayerDuration(1300))
        expect(result.current.duration).toBe(0)
        act(() => { vi.runAllTimers() })
        expect(result.current.duration).toBe(1300)
    })
})

function fakeVideo(duration = 1000) {
    return { currentTime: 0, duration } as unknown as HTMLVideoElement
}

function renderSeek(video: HTMLVideoElement, options?: { thumbRef?: React.RefObject<HTMLDivElement | null>; progressInputRef?: React.RefObject<HTMLInputElement | null>; duration?: number }) {
    const checkManualSkipOverrides = vi.fn()
    const triggerControlsVisibility = vi.fn()
    const videoRef = { current: video } as React.RefObject<HTMLVideoElement | null>
    const hook = renderHook(() => usePlayerSeek({ videoRef, checkManualSkipOverrides, triggerControlsVisibility, ...options }))
    return { ...hook, checkManualSkipOverrides, triggerControlsVisibility }
}

const seekTo = (time: number) => ({ target: { value: String(time) }, currentTarget: { value: String(time) } }) as React.ChangeEvent<HTMLInputElement>

describe("usePlayerSeek", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(10_000)
    })
    afterEach(() => vi.useRealTimers())

    it("throttles real seeks and applies the latest pending one", () => {
        const video = fakeVideo()
        const { result, checkManualSkipOverrides } = renderSeek(video)

        act(() => result.current.handleSeek(seekTo(100)))
        expect(video.currentTime).toBe(100)
        expect(checkManualSkipOverrides).toHaveBeenCalledWith(100)

        // Dentro de la ventana de throttle: no se mueve todavía.
        act(() => result.current.handleSeek(seekTo(200)))
        act(() => result.current.handleSeek(seekTo(300)))
        expect(video.currentTime).toBe(100)

        act(() => { vi.advanceTimersByTime(SEEK_THROTTLE_MS) })
        expect(video.currentTime).toBe(300)
    })

    it("does not seek the video while dragging, only on release", () => {
        const video = fakeVideo()
        const { result, triggerControlsVisibility } = renderSeek(video)

        act(() => result.current.handleSeekStart())
        act(() => result.current.handleSeek(seekTo(500)))
        expect(video.currentTime).toBe(0)
        expect(result.current.isSeeking).toBe(true)

        const release = { currentTarget: { value: "520" } } as unknown as React.MouseEvent<HTMLInputElement>
        act(() => result.current.handleSeekEnd(release))
        expect(video.currentTime).toBe(520)
        expect(result.current.isSeeking).toBe(false)
        expect(triggerControlsVisibility).toHaveBeenCalled()
    })

    it("clamps skipTime to [0, duration] and ignores non-finite targets", () => {
        const video = fakeVideo(100)
        video.currentTime = 95
        const { result } = renderSeek(video)

        act(() => result.current.skipTime(30))
        expect(video.currentTime).toBe(100)

        vi.setSystemTime(20_000)
        act(() => result.current.skipTime(-500))
        expect(video.currentTime).toBe(0)

        vi.setSystemTime(30_000)
        act(() => result.current.handleSeek(seekTo(NaN)))
        expect(video.currentTime).toBe(0)
    })

    it("synchronizes thumbRef and progressInputRef immediately during seek and seekEnd", () => {
        const video = fakeVideo(1000)
        const thumbDiv = document.createElement("div")
        const thumbRef = { current: thumbDiv }
        const progressInput = document.createElement("input")
        progressInput.type = "range"
        progressInput.max = "1000"
        const progressInputRef = { current: progressInput }

        const { result } = renderSeek(video, { thumbRef, progressInputRef })

        // During seek (dragging / scrubbing), thumb and input sync immediately
        act(() => result.current.handleSeekStart())
        act(() => result.current.handleSeek(seekTo(400)))
        expect(thumbDiv.style.transform).toBe("translateX(40%)")
        expect(progressInput.value).toBe("400")

        // On seek end, thumb and input sync to final position
        const release = { currentTarget: { value: "450" } } as unknown as React.MouseEvent<HTMLInputElement>
        act(() => result.current.handleSeekEnd(release))
        expect(thumbDiv.style.transform).toBe("translateX(45%)")
        expect(progressInput.value).toBe("450")
    })
})
