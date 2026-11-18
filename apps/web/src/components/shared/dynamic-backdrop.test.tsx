import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { DynamicBackdrop } from "./dynamic-backdrop"

const flags = vi.hoisted(() => ({ path: "/home", flat: false, enabled: true }))
vi.mock("@tanstack/react-router", () => ({ useLocation: () => flags.path }))
vi.mock("@/lib/theme/theme-hooks", () => ({ useThemeSettings: () => ({ effectiveMode: "classic", themeEra: "classic" }) }))
vi.mock("@/lib/theme/apply-custom-theme", () => ({ useTransparencyState: () => ({ flat: flags.flat }) }))
vi.mock("@/components/ui/kinetics/hooks", () => ({ useReducedMotion: () => false }))
vi.mock("@/lib/store", () => ({
    useAppStore: (select: (state: { dynamicBackdropEnabled: boolean; dynamicBackdropMotionEnabled: boolean }) => unknown) =>
        select({ dynamicBackdropEnabled: flags.enabled, dynamicBackdropMotionEnabled: false }),
}))

let preloads = 0
beforeEach(() => {
    vi.useFakeTimers()
    preloads = 0
    flags.path = "/home"
    flags.flat = false
    flags.enabled = true
    useIntelligenceStore.setState({ currentBackdropUrl: "/first-background.jpg" })
    vi.stubGlobal("Image", class { constructor() { preloads++ } })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("global backdrop image budget", () => {
    it.each(["/home", "/movies", "/series", "/settings", "/chronology", "/series/12", "/movies/4"])("avoids duplicate image preloads and crossfades on %s", path => {
        flags.path = path
        render(<DynamicBackdrop />)
        act(() => useIntelligenceStore.setState({ currentBackdropUrl: "/second-background.jpg" }))
        expect(preloads).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })
    it("keeps crossfades when the global image is actually visible", () => {
        flags.path = "/other"
        render(<DynamicBackdrop />)
        act(() => useIntelligenceStore.setState({ currentBackdropUrl: "/second-background.jpg" }))
        expect(preloads).toBe(1)
        expect(vi.getTimerCount()).toBe(1)
        act(() => vi.advanceTimersByTime(350))
        expect(vi.getTimerCount()).toBe(0)
    })
    it("skips unused images in flat mode", () => {
        flags.path = "/other"
        flags.flat = true
        render(<DynamicBackdrop />)
        act(() => useIntelligenceStore.setState({ currentBackdropUrl: "/second-background.jpg" }))
        expect(preloads).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })
})
