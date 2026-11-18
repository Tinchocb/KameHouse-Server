import { describe, expect, it, vi, beforeEach } from "vitest"
import { useMotionTier, cardMotionProps } from "./motion-tier"

const mockReducedMotion = vi.fn()
const mockIsHeavyAllowed = vi.fn()

vi.mock("@/hooks/use-reduced-motion", () => ({
    useReducedMotion: () => mockReducedMotion(),
}))

vi.mock("@/lib/hardware/performance-store", () => ({
    selectIsHeavyEffectsAllowed: vi.fn(),
    usePerformanceStore: (selector: unknown) => mockIsHeavyAllowed(selector),
}))


describe("motion-tier", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockReducedMotion.mockReturnValue(false)
        mockIsHeavyAllowed.mockReturnValue(true)
    })

    describe("useMotionTier", () => {
        it("returns 'off' when prefersReducedMotion is true", () => {
            mockReducedMotion.mockReturnValue(true)
            expect(useMotionTier()).toBe("off")
        })


        it("returns 'subtle' when heavy effects are not allowed (low_power / throttled)", () => {
            mockIsHeavyAllowed.mockReturnValue(false)
            expect(useMotionTier()).toBe("subtle")
        })

        it("prioritizes 'off' over 'subtle' when both reduced motion and low_power match", () => {
            mockReducedMotion.mockReturnValue(true)
            mockIsHeavyAllowed.mockReturnValue(false)
            expect(useMotionTier()).toBe("off")
        })

        it("returns 'full' when hardware is capable, and motion is allowed", () => {
            expect(useMotionTier()).toBe("full")
        })
    })

    describe("cardMotionProps", () => {
        it("keeps press feedback but omits hover on touch devices", () => {
            const props = cardMotionProps("full", false)
            expect(props.whileHover).toBeUndefined()
            expect(props.whileTap).toEqual({ scale: 0.97 })
        })
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

        it("keeps neutral gesture targets so pointerup can clear a press interrupted by reduced motion", () => {
            expect(cardMotionProps("off")).toEqual({
                whileHover: { y: 0, transition: { duration: 0 } },
                whileTap: { scale: 1, transition: { duration: 0 } },
                transition: { duration: 0 },
            })
        })

        it("applies Minimalist profile: no card hover elevation, scale(0.98), 160ms ease", () => {
            const props = cardMotionProps("full", true, true)
            expect(props.whileHover).toEqual({ y: 0 })
            expect(props.whileTap).toEqual({ scale: 0.98 })
            expect(props.transition).toEqual({
                duration: 0.16,
                ease: [0.23, 1, 0.32, 1],
            })
        })

        it("detects Minimalist mode automatically from DOM dataset when options omitted", () => {
            document.documentElement.dataset.uiStyle = "classic-minimalist"
            try {
                const props = cardMotionProps("full")
                expect(props.whileHover).toEqual({ y: 0 })
                expect(props.whileTap).toEqual({ scale: 0.98 })
            } finally {
                delete document.documentElement.dataset.uiStyle
            }
        })
    })
})
