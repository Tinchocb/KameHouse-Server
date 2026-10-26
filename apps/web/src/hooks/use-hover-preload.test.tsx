import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useHoverPreload } from "./use-hover-preload"

describe("precarga por intención", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("usa el callback del último commit aunque el hover ya esté pendiente", () => {
        const first = vi.fn()
        const latest = vi.fn()
        const view = renderHook(({ onPreload }) => useHoverPreload({ onPreload }), { initialProps: { onPreload: first } })
        act(() => view.result.current.onMouseEnter("42"))
        view.rerender({ onPreload: latest })
        act(() => vi.advanceTimersByTime(300))
        expect(first).not.toHaveBeenCalled()
        expect(latest).toHaveBeenCalledExactlyOnceWith("42")
    })

    it("cancela la intención al salir y las restantes al desmontarse", () => {
        const onPreload = vi.fn()
        const view = renderHook(() => useHoverPreload({ onPreload }))
        act(() => {
            view.result.current.onMouseEnter("42")
            view.result.current.onMouseEnter("43")
            view.result.current.onMouseLeave("42")
        })
        expect(vi.getTimerCount()).toBe(1)
        view.unmount()
        expect(vi.getTimerCount()).toBe(0)
        act(() => vi.advanceTimersByTime(300))
        expect(onPreload).not.toHaveBeenCalled()
    })
})
