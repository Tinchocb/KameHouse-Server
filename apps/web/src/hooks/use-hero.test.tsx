import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useHeroParallax } from "./use-hero"
import type { RefObject } from "react"

let intersect: IntersectionObserverCallback
let mediaChange: () => void
let reduced = false
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()
const tick = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(0)) }

function Hero({ disabled = false, scrollContainerRef }: { disabled?: boolean; scrollContainerRef?: RefObject<HTMLElement | null> }) {
    const ref = useHeroParallax(0.1, { disabled, maxOffset: 40, scrollContainerRef })
    return <div ref={ref} data-testid="hero"><div data-testid="carousel" /></div>
}

beforeEach(() => {
    frames.clear()
    reduced = false
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback: IntersectionObserverCallback) { intersect = callback }
        observe() {}
        disconnect() {}
    })
    vi.stubGlobal("matchMedia", () => ({
        get matches() { return reduced },
        addEventListener: (_: string, callback: () => void) => { mediaChange = callback },
        removeEventListener() {},
    }))
})
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function fixture() {
    const scroller = document.createElement("main")
    scroller.dataset.scrollContainer = "true"
    document.body.append(scroller)
    const style = vi.spyOn(window, "getComputedStyle").mockImplementation(element => ({ overflowY: element === scroller ? "auto" : "visible" }) as CSSStyleDeclaration)
    const view = render(<Hero />, { container: scroller })
    tick()
    return { scroller, style, ...view }
}

describe("hero parallax workload", () => {
    it("uses an explicit container instead of the automatically detected page", () => {
        const owner = document.createElement("main")
        owner.dataset.scrollContainer = "true"
        const explicit = document.createElement("div")
        document.body.append(owner, explicit)
        const view = render(<Hero scrollContainerRef={{ current: explicit }} />, { container: owner })
        tick()
        owner.scrollTop = 100
        owner.dispatchEvent(new Event("scroll"))
        expect(frames.size).toBe(0)
        explicit.scrollTop = 200
        explicit.dispatchEvent(new Event("scroll"))
        tick()
        expect(view.getByTestId("hero").style.transform).toBe("translate3d(0, 20px, 0)")
        view.unmount()
        explicit.dispatchEvent(new Event("scroll"))
        expect(frames.size).toBe(0)
    })
    it("resolves the scroll owner once and ignores nested carousels", () => {
        const { scroller, style, getByTestId, unmount } = fixture()
        const hero = getByTestId("hero")
        style.mockClear()
        getByTestId("carousel").dispatchEvent(new Event("scroll"))
        expect(frames.size).toBe(0)
        scroller.scrollTop = 200
        scroller.dispatchEvent(new Event("scroll"))
        tick()
        expect(hero.style.transform).toBe("translate3d(0, 20px, 0)")
        expect(style).not.toHaveBeenCalled()
        scroller.scrollTop = 900
        scroller.dispatchEvent(new Event("scroll"))
        tick()
        expect(hero.style.transform).toBe("translate3d(0, 40px, 0)")
        unmount()
        expect(hero.style.transform).toBe("")
    })
    it("does no frame work outside the viewport and catches up on re-entry", () => {
        const { scroller, getByTestId } = fixture()
        intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
        scroller.scrollTop = 120
        scroller.dispatchEvent(new Event("scroll"))
        expect(frames.size).toBe(0)
        intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
        tick()
        expect(getByTestId("hero").style.transform).toBe("translate3d(0, 12px, 0)")
    })
    it("cleans transforms and frames when reduced motion is enabled at runtime", () => {
        const { scroller, getByTestId } = fixture()
        scroller.scrollTop = 100
        scroller.dispatchEvent(new Event("scroll"))
        tick()
        act(() => { reduced = true; mediaChange() })
        expect(getByTestId("hero").style.transform).toBe("")
        scroller.dispatchEvent(new Event("scroll"))
        expect(frames.size).toBe(0)
    })
})
