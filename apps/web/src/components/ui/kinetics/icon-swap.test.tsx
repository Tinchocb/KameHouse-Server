import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { iconSwapStates, useTransientFlag } from "./icon-swap"

describe("iconSwapStates", () => {
    it("en tier full anima scale y blur", () => {
        const { hidden, shown } = iconSwapStates("full")
        expect(hidden).toEqual({ opacity: 0, scale: 0.9, filter: "blur(2px)" })
        expect(shown).toEqual({ opacity: 1, scale: 1, filter: "blur(0px)" })
    })

    it("en tier subtle anima scale y opacity, sin filter", () => {
        const { hidden, shown } = iconSwapStates("subtle")
        expect(hidden).toEqual({ opacity: 0, scale: 0.96 })
        expect(shown).toEqual({ opacity: 1, scale: 1 })
        expect(hidden).not.toHaveProperty("filter")
        expect(shown).not.toHaveProperty("filter")
    })

    it("con movimiento reducido (tier off) solo hace fade, como antes", () => {
        const { hidden, shown } = iconSwapStates("off")
        expect(hidden).toEqual({ opacity: 0 })
        expect(shown).toEqual({ opacity: 1 })
    })
})

describe("useTransientFlag", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("se enciende y se apaga sola; volver a disparar reinicia el plazo", () => {
        const { result } = renderHook(() => useTransientFlag(1000))
        expect(result.current[0]).toBe(false)

        act(() => result.current[1]())
        expect(result.current[0]).toBe(true)

        act(() => vi.advanceTimersByTime(800))
        act(() => result.current[1]())
        act(() => vi.advanceTimersByTime(800))
        expect(result.current[0]).toBe(true)

        act(() => vi.advanceTimersByTime(300))
        expect(result.current[0]).toBe(false)
    })
})
