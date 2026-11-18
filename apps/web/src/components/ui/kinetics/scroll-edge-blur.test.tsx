import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ScrollEdgeBlur } from "./scroll-edge-blur"

const state = vi.hoisted(() => ({ scrollBlurEnabled: false, tier: "full" }))
vi.mock("./motion-tier", () => ({ useMotionTier: () => state.tier }))
vi.mock("@/lib/stores/ui-store", () => ({ useUIStore: (selector: (store: typeof state) => unknown) => selector(state) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("scroll blur listeners", () => {
    it("only subscribes while the effect is enabled and cleans up when disabled", () => {
        state.scrollBlurEnabled = false
        state.tier = "full"
        const add = vi.spyOn(window, "addEventListener")
        const remove = vi.spyOn(window, "removeEventListener")
        const view = render(<ScrollEdgeBlur />)
        expect(add.mock.calls.filter(([event]) => String(event) === "scroll")).toHaveLength(0)
        state.scrollBlurEnabled = true
        view.rerender(<ScrollEdgeBlur />)
        expect(add.mock.calls.filter(([event]) => String(event) === "scroll")).toHaveLength(1)
        state.scrollBlurEnabled = false
        view.rerender(<ScrollEdgeBlur />)
        expect(remove.mock.calls.filter(([event]) => String(event) === "scroll")).toHaveLength(1)
    })
    it("does not observe scrolling with reduced motion", () => {
        state.scrollBlurEnabled = true
        state.tier = "off"
        const add = vi.spyOn(window, "addEventListener")
        render(<ScrollEdgeBlur />)
        expect(add.mock.calls.filter(([event]) => String(event) === "scroll")).toHaveLength(0)
    })
})
