import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type React from "react"
import type Hls from "hls.js"
import { usePlayerControlsVisibility, CONTROLS_HIDE_DELAY_MS } from "./usePlayerControlsVisibility"
import { usePlayerStreamSwitch } from "./usePlayerStreamSwitch"
import { usePlayerPlaybackPrefs } from "./usePlayerPlaybackPrefs"
import { usePlayerHlsLevel } from "./usePlayerHlsLevel"

function videoRefOf(video: Partial<HTMLVideoElement>) {
    return { current: video as HTMLVideoElement } as React.RefObject<HTMLVideoElement | null>
}

describe("usePlayerControlsVisibility", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("hides the controls after the delay while playing", async () => {
        const { result } = renderHook(() => usePlayerControlsVisibility({ isPlaying: true }))
        await act(async () => { await Promise.resolve() })
        expect(result.current.controlsVisible).toBe(true)

        act(() => { vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS) })
        expect(result.current.controlsVisible).toBe(false)
    })

    it("keeps them visible while paused", async () => {
        const { result } = renderHook(() => usePlayerControlsVisibility({ isPlaying: false }))
        await act(async () => { await Promise.resolve() })
        act(() => { vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS * 2) })
        expect(result.current.controlsVisible).toBe(true)
    })

    it("does not auto-hide while the settings panel is open", async () => {
        const { result } = renderHook(() => usePlayerControlsVisibility({ isPlaying: true }))
        await act(async () => { await Promise.resolve() })
        act(() => result.current.setIsSettingsOpen(true))
        act(() => result.current.triggerControlsVisibility())
        act(() => { vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS) })
        expect(result.current.controlsVisible).toBe(true)
        expect(result.current.isSettingsOpen).toBe(true)
    })
})

describe("usePlayerStreamSwitch", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    function render(status: "loading" | "ready" | "error" = "loading", streamType: "direct" | "transcode" = "direct") {
        const video = { currentTime: 312, readyState: 0, videoWidth: 0, removeAttribute: vi.fn() }
        const resumeRef = { current: null as number | null }
        const onRequestStreamTypeChange = vi.fn()
        const hook = renderHook(
            ({ status }) => usePlayerStreamSwitch({
                videoRef: videoRefOf(video as unknown as HTMLVideoElement),
                streamSwitchResumeRef: resumeRef,
                status,
                mediaId: 1,
                episodeNumber: 1,
                streamType,
                onRequestStreamTypeChange,
            }),
            { initialProps: { status } },
        )
        return { ...hook, video, resumeRef, onRequestStreamTypeChange }
    }

    it("switchSource resumes at the current time and forces transcode", () => {
        const { result, resumeRef, onRequestStreamTypeChange } = render()
        act(() => result.current.switchSource("transcode"))
        expect(resumeRef.current).toBe(312)
        expect(result.current.isStreamSwitching).toBe(true)
        expect(result.current.streamSwitchReason).toBe("source")
        expect(onRequestStreamTypeChange).toHaveBeenCalledWith("transcode", { force: true })
    })

    it("ignores the current or an unknown stream type", () => {
        const { result, onRequestStreamTypeChange } = render()
        act(() => result.current.switchSource("direct"))
        act(() => result.current.switchSource("online"))
        expect(onRequestStreamTypeChange).not.toHaveBeenCalled()
        expect(result.current.isStreamSwitching).toBe(false)
    })

    it("clears the switch and the frozen poster once the new stream is ready", () => {
        const { result, rerender, video } = render()
        act(() => result.current.onAudioStreamSwitch(100))
        expect(result.current.streamSwitchReason).toBe("audio")
        expect(result.current.isStreamSwitching).toBe(true)

        rerender({ status: "ready" })
        act(() => { vi.runAllTimers() })
        expect(result.current.isStreamSwitching).toBe(false)
        expect(video.removeAttribute).toHaveBeenCalledWith("poster")
    })
})

describe("usePlayerPlaybackPrefs", () => {
    it("persists the rate and applies it to the video, loop included", () => {
        const video = { playbackRate: 1, defaultPlaybackRate: 1, loop: false }
        const setPlaybackRate = vi.fn()
        const { result } = renderHook(() => usePlayerPlaybackPrefs({
            videoRef: videoRefOf(video as unknown as HTMLVideoElement),
            status: "ready",
            playbackRate: 1.25,
            setPlaybackRate,
            loopEnabled: true,
        }))
        // Los efectos aplican la preferencia actual al montar.
        expect(video.playbackRate).toBe(1.25)
        expect(video.loop).toBe(true)

        act(() => result.current.changePlaybackRate(2))
        expect(setPlaybackRate).toHaveBeenCalledWith(2)
        expect(video.playbackRate).toBe(2)
        expect(video.defaultPlaybackRate).toBe(2)
    })
})

describe("usePlayerHlsLevel", () => {
    it("pins a level, and -1 goes back to automatic", () => {
        const hls = { currentLevel: -1, nextLevel: -1 }
        const hlsRef = { current: hls as unknown as Hls }
        const { result } = renderHook(() => usePlayerHlsLevel({ hlsRef }))

        act(() => result.current.setHlsLevel(2))
        expect(hls).toEqual({ currentLevel: 2, nextLevel: 2 })
        expect(result.current.activeHlsLevel).toBe(2)

        act(() => result.current.setHlsLevel(-1))
        expect(hls).toEqual({ currentLevel: -1, nextLevel: -1 })
        expect(result.current.activeHlsLevel).toBe(-1)
    })

    it("does nothing without an hls.js instance", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        const { result } = renderHook(() => usePlayerHlsLevel({ hlsRef: { current: null } }))
        act(() => result.current.setHlsLevel(1))
        expect(result.current.activeHlsLevel).toBe(-1)
        warn.mockRestore()
    })
})
