import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useReducedMotion } from "./use-reduced-motion"
import { useSpringPreset } from "@/components/ui/kinetics/hooks"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("preferencia de movimiento en vivo", () => {
    it("cambia el preset sin remontar y limpia la suscripción al cerrar", () => {
        let notify = () => {}
        const media = {
            matches: false,
            addEventListener: vi.fn((_event: string, callback: () => void) => { notify = callback }),
            removeEventListener: vi.fn(),
        }
        vi.stubGlobal("matchMedia", vi.fn(() => media))
        const { result, unmount } = renderHook(() => ({ reduced: useReducedMotion(), spring: useSpringPreset() }))
        expect(result.current.reduced).toBe(false)
        expect(result.current.spring.type).toBe("spring")
        act(() => { media.matches = true; notify() })
        expect(result.current.reduced).toBe(true)
        expect(result.current.spring).toEqual({ type: "tween", duration: 0.15 })
        act(() => { media.matches = false; notify() })
        expect(result.current.spring.type).toBe("spring")
        expect(media.addEventListener).toHaveBeenCalledTimes(1)
        unmount()
        expect(media.removeEventListener).toHaveBeenCalledTimes(1)
    })
})
