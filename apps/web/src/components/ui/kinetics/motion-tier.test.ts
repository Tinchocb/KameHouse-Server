import { describe, expect, it, vi, beforeEach } from "vitest"
import { useMotionTier, cardMotionProps } from "./motion-tier"

const mockReducedMotion = vi.fn()
const mockIsHeavyAllowed = vi.fn()
const mockTvMode = vi.fn()

vi.mock("framer-motion", () => ({
    useReducedMotion: () => mockReducedMotion(),
}))

vi.mock("@/lib/hardware/performance-store", () => ({
    selectIsHeavyEffectsAllowed: vi.fn(),
    usePerformanceStore: (selector: unknown) => mockIsHeavyAllowed(selector),
}))

vi.mock("@/lib/stores", () => ({
    useAppStore: (selector: (state: { tvMode: boolean }) => unknown) =>
        selector({ tvMode: mockTvMode() }),
}))

describe("motion-tier", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockReducedMotion.mockReturnValue(false)
        mockIsHeavyAllowed.mockReturnValue(true)
        mockTvMode.mockReturnValue(false)
    })

    describe("useMotionTier", () => {
        it("returns 'off' when prefersReducedMotion is true", () => {
            mockReducedMotion.mockReturnValue(true)
            expect(useMotionTier()).toBe("off")
        })

        it("returns 'subtle' when tvMode is active", () => {
            mockTvMode.mockReturnValue(true)
            expect(useMotionTier()).toBe("subtle")
        })

        it("returns 'subtle' when heavy effects are not allowed (low_power / throttled)", () => {
            mockIsHeavyAllowed.mockReturnValue(false)
            expect(useMotionTier()).toBe("subtle")
        })

        it("prioritizes 'off' over 'subtle' when both reduced motion and tvMode/low_power match", () => {
            mockReducedMotion.mockReturnValue(true)
            mockTvMode.mockReturnValue(true)
            mockIsHeavyAllowed.mockReturnValue(false)
            expect(useMotionTier()).toBe("off")
        })

        it("returns 'full' when hardware is capable, not in tvMode, and motion is allowed", () => {
            expect(useMotionTier()).toBe("full")
        })
    })

    describe("cardMotionProps", () => {
        it("returns hover y:-4 and tap scale 0.97 for 'full' tier", () => {
            const props = cardMotionProps("full")
            expect(props.whileHover).toEqual({ y: -4 })
            expect(props.whileTap).toEqual({ scale: 0.97 })
            expect(props.transition).toEqual({
                type: "spring",
                stiffness: 380,
                damping: 30,
            })
        })

        it("returns empty object for 'subtle' tier (delegating to CSS)", () => {
            expect(cardMotionProps("subtle")).toEqual({})
        })

        it("returns empty object for 'off' tier", () => {
            expect(cardMotionProps("off")).toEqual({})
        })
    })
})
