import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useMediaQuery } from "./use-media-query"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("shared media preferences", () => {
    it("shares one native subscription and keeps it stable across renders", () => {
        let notify = () => {}
        const add = vi.fn((_event: string, callback: () => void) => { notify = callback })
        const remove = vi.fn()
        const media = { matches: false, addEventListener: add, removeEventListener: remove }
        const match = vi.fn(() => media)
        vi.stubGlobal("matchMedia", match)
        const consumers = Array.from({ length: 40 }, () => renderHook(() => useMediaQuery("(min-width: 777px)")))
        expect(add).toHaveBeenCalledTimes(1)
        expect(match).toHaveBeenCalledTimes(1)
        for (const consumer of consumers) consumer.rerender()
        expect(add).toHaveBeenCalledTimes(1)
        act(() => { media.matches = true; notify() })
        expect(consumers.every(consumer => consumer.result.current)).toBe(true)
        consumers[0].unmount()
        expect(remove).not.toHaveBeenCalled()
        for (const consumer of consumers.slice(1)) consumer.unmount()
        expect(remove).toHaveBeenCalledTimes(1)
    })
    it("detaches the old query when a breakpoint changes", () => {
        const first = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
        const second = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
        vi.stubGlobal("matchMedia", vi.fn((query: string) => query.includes("888") ? first : second))
        const { result, rerender } = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query: "(min-width: 888px)" } })
        expect(result.current).toBe(true)
        rerender({ query: "(min-width: 999px)" })
        expect(result.current).toBe(false)
        expect(first.removeEventListener).toHaveBeenCalledTimes(1)
        expect(second.addEventListener).toHaveBeenCalledTimes(1)
    })
    it("preserves the caller's fallback without matchMedia", () => {
        vi.stubGlobal("matchMedia", undefined)
        const { result } = renderHook(() => useMediaQuery("(min-width: 111px)", true))
        expect(result.current).toBe(true)
    })
})
