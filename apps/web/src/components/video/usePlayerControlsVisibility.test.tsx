import { StrictMode } from "react"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CONTROLS_HIDE_DELAY_MS, usePlayerControlsVisibility } from "./usePlayerControlsVisibility"

describe("autoocultado de controles", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => { vi.useRealTimers(); document.body.innerHTML = "" })

    it.each(["player-top-bar", "player-bottom-bar"])("mantiene visibles los controles enfocados en %s", async (className) => {
        const bar = document.createElement("div")
        bar.className = className
        const button = document.createElement("button")
        bar.appendChild(button)
        document.body.appendChild(bar)
        const { result } = renderHook(() => usePlayerControlsVisibility({ isPlaying: true }))
        await act(async () => {})
        button.focus()
        act(() => vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS))
        expect(result.current.controlsVisible).toBe(true)
        button.blur()
        act(() => result.current.triggerControlsVisibility())
        act(() => vi.advanceTimersByTime(CONTROLS_HIDE_DELAY_MS))
        expect(result.current.controlsVisible).toBe(false)
    })

    it("no crea timers desde microtareas después de desmontarse en StrictMode", async () => {
        const view = renderHook(() => usePlayerControlsVisibility({ isPlaying: true }), { wrapper: StrictMode })
        view.unmount()
        await act(async () => {})
        expect(vi.getTimerCount()).toBe(0)
    })

    it("StrictMode conserva un único timer y lo cancela al desmontar", async () => {
        const view = renderHook(() => usePlayerControlsVisibility({ isPlaying: true }), { wrapper: StrictMode })
        await act(async () => {})
        expect(vi.getTimerCount()).toBe(1)
        view.unmount()
        expect(vi.getTimerCount()).toBe(0)
    })
})
