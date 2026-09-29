import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTransientFlag } from "./icon-swap"

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
