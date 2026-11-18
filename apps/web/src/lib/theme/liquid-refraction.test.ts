import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createRefractionProfile, mountLiquidRefraction, MAX_LIQUID_LENSES } from "./liquid-refraction"

const NS = "http://www.w3.org/2000/svg"
let cleanup: (() => void) | undefined
let onIntersection: IntersectionObserverCallback
beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
        observe() {}
        unobserve() {}
        disconnect() {}
    })
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback: IntersectionObserverCallback) { onIntersection = callback }
        observe() {}
        unobserve() {}
        disconnect() {}
    })
})
afterEach(() => {
    cleanup?.()
    cleanup = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

function fixture() {
    const svg = document.createElementNS(NS, "svg")
    const defs = document.createElementNS(NS, "defs")
    svg.append(defs)
    const nav = document.createElement("nav")
    nav.className = "floating-nav-island"
    nav.style.borderRadius = "9999px"
    Object.defineProperties(nav, { offsetWidth: { value: 400, configurable: true }, offsetHeight: { value: 64 } })
    document.body.append(svg, nav)
    return { defs, nav }
}

describe("procedural optical lens", () => {
    it("clamps pill curvature to the short side rather than its CSS radius", () => {
        expect(createRefractionProfile(400, 64, 9999)).toEqual(createRefractionProfile(400, 64, 32))
        expect(createRefractionProfile(400, 64, -1).rounding).toBeGreaterThan(0)
    })
    it("normalizes the derivative for high-density displays", () => {
        const regular = createRefractionProfile(400, 64, 32, 1)
        const retina = createRefractionProfile(400, 64, 32, 2)
        expect(retina.divisor).toBe(regular.divisor / 2)
        expect(retina.scale).toBe(regular.scale)
        expect(retina.edge).toBe(regular.edge)
    })
    it("limits optical thickness for small controls and large dialogs", () => {
        expect(createRefractionProfile(20, 20, 10).scale).toBe(12)
        expect(createRefractionProfile(1920, 1080, 24).scale).toBe(36)
    })
    it("opens the floating lens while preserving the neutral video profile", () => {
        const panel = createRefractionProfile(900, 600, 24, 1, { surface: "panel" })
        expect(panel.scale).toBe(36)
        expect(panel.blur).toBe(3)
        expect(panel.guard).toBe(9)
        const video = createRefractionProfile(900, 600, 24, 2, { surface: "panel", video: true })
        expect(video.scale).toBe(24)
        expect(video.blur).toBe(2)
        expect(video.saturation).toBe(1)
    })
    it("never creates lenses for content or controls, even inside a content wrapper", () => {
        const { defs } = fixture()
        const content = document.createElement("section")
        content.dataset.liquidSurface = "content"
        const control = document.createElement("button")
        control.dataset.liquidSurface = "control"
        content.append(control)
        document.body.append(content)
        cleanup = mountLiquidRefraction(defs)
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        expect(content.dataset.liquidReady).toBeUndefined()
        expect(control.dataset.liquidReady).toBeUndefined()
    })
    it("prioritizes focused surfaces then panels within the eight-lens budget", () => {
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length })
        const { defs } = fixture()
        const elements = Array.from({ length: 12 }, (_, index) => {
            const element = document.createElement("button")
            element.dataset.liquidSurface = index < 4 ? "panel" : "navigation"
            Object.defineProperties(element, { offsetWidth: { value: 150 }, offsetHeight: { value: 64 } })
            document.body.append(element)
            return element
        })
        cleanup = mountLiquidRefraction(defs)
        expect(defs.children).toHaveLength(MAX_LIQUID_LENSES)
        expect(elements.slice(0, 4).every(element => element.dataset.liquidReady)).toBe(true)
        expect(elements[11].dataset.liquidReady).toBeUndefined()
        elements[11].focus()
        for (const callback of frames.splice(0)) callback(0)
        expect(elements[11].dataset.liquidReady).toBe("true")
        expect(defs.children).toHaveLength(MAX_LIQUID_LENSES)
        expect(elements.slice(0, 4).every(element => element.dataset.liquidReady)).toBe(true)
    })
    it("restores panel priority on blur and coalesces focus changes with cancellable cleanup", () => {
        let nextFrame = 0
        const frames = new Map<number, FrameRequestCallback>()
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
            frames.set(++nextFrame, callback)
            return nextFrame
        })
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id) })
        const advanceFrame = () => {
            const pending = [...frames.values()]
            frames.clear()
            for (const callback of pending) callback(0)
        }
        const { defs, nav } = fixture()
        const panels = Array.from({ length: 8 }, () => {
            const element = document.createElement("button")
            element.dataset.liquidSurface = "panel"
            Object.defineProperties(element, { offsetWidth: { value: 150 }, offsetHeight: { value: 64 } })
            document.body.append(element)
            return element
        })
        nav.tabIndex = 0
        cleanup = mountLiquidRefraction(defs)
        expect(nav.dataset.liquidReady).toBeUndefined()
        nav.focus()
        advanceFrame()
        expect(nav.dataset.liquidReady).toBe("true")
        expect(defs.children).toHaveLength(MAX_LIQUID_LENSES)
        nav.blur()
        expect(document.activeElement).toBe(document.body)
        expect(frames.size).toBe(1)
        advanceFrame()
        expect(nav.dataset.liquidReady).toBeUndefined()
        expect(panels.every(panel => panel.dataset.liquidReady === "true")).toBe(true)
        expect(defs.children).toHaveLength(MAX_LIQUID_LENSES)
        for (let i = 0; i < 20; i++) {
            nav.focus()
            panels[i % panels.length].focus()
        }
        expect(frames.size).toBe(1)
        advanceFrame()
        expect(nav.dataset.liquidReady).toBeUndefined()
        expect(defs.children).toHaveLength(MAX_LIQUID_LENSES)
        nav.focus()
        expect(frames.size).toBe(1)
        cleanup()
        expect(frames.size).toBe(0)
        expect(defs.children).toHaveLength(0)
        expect(document.querySelectorAll("[data-liquid-ready]")).toHaveLength(0)
        nav.blur()
        nav.focus()
        expect(frames.size).toBe(0)
    })
    it("detaches offscreen lenses and resumes the same graph on entry", () => {
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length })
        const { defs, nav } = fixture()
        cleanup = mountLiquidRefraction(defs)
        const filter = defs.firstElementChild
        const nodes = filter ? Array.from(filter.children) : []
        const visibility = (isIntersecting: boolean): IntersectionObserverEntry => ({
            target: nav, isIntersecting, time: 0, intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: new DOMRect(0, 0, 400, 64), intersectionRect: new DOMRect(), rootBounds: null,
        })
        onIntersection([visibility(false)], {} as IntersectionObserver)
        for (const callback of frames.splice(0)) callback(0)
        expect(defs.children).toHaveLength(0)
        expect(nav.dataset.liquidReady).toBeUndefined()
        onIntersection([visibility(true)], {} as IntersectionObserver)
        for (const callback of frames.splice(0)) callback(0)
        expect(defs.firstElementChild).toBe(filter)
        expect(filter ? Array.from(filter.children) : []).toEqual(nodes)
    })
    it("attaches only to explicit floating surfaces, without stacking lenses", () => {
        const { defs, nav } = fixture()
        const nested = document.createElement("div")
        nested.dataset.liquidSurface = "panel"
        nav.append(nested)
        const card = document.createElement("div")
        card.className = "surface-content"
        document.body.append(card)
        cleanup = mountLiquidRefraction(defs)
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        expect(nav.dataset.liquidReady).toBe("true")
        expect(nested.dataset.liquidReady).toBeUndefined()
        expect(card.dataset.liquidReady).toBeUndefined()
        expect(nav.style.filter).toBe("")
    })
    it("releases filters and surface styles, including after a strict-mode remount", () => {
        const { defs, nav } = fixture()
        cleanup = mountLiquidRefraction(defs)
        cleanup()
        expect(defs.children).toHaveLength(0)
        expect(nav.dataset.liquidReady).toBeUndefined()
        expect(nav.style.getPropertyValue("--liquid-refraction-filter")).toBe("")
        cleanup = mountLiquidRefraction(defs)
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        expect(nav.dataset.liquidReady).toBe("true")
    })
    it("coalesces resize bursts without replacing the filter graph", () => {
        let onResize: ResizeObserverCallback = () => {}
        vi.stubGlobal("ResizeObserver", class {
            constructor(callback: ResizeObserverCallback) { onResize = callback }
            observe() {}
            unobserve() {}
            disconnect() {}
        })
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length })
        const { defs, nav } = fixture()
        cleanup = mountLiquidRefraction(defs)
        const filter = defs.querySelector("filter")
        if (!filter) throw new Error("Missing optical filter")
        const originalNodes = Array.from(filter.children)
        const url = nav.style.getPropertyValue("--liquid-refraction-filter")
        for (let i = 0; i < 50; i++) {
            Object.defineProperty(nav, "offsetWidth", { value: 401 + i, configurable: true })
            onResize([{
                target: nav, contentRect: new DOMRect(), borderBoxSize: [],
                contentBoxSize: [], devicePixelContentBoxSize: [],
            }], {} as ResizeObserver)
        }
        expect(frames).toHaveLength(1)
        frames[0](0)
        expect(Array.from(filter.children)).toEqual(originalNodes)
        expect(filter.querySelector('[result="box"]')?.getAttribute("width")).toBe("450")
        expect(nav.style.getPropertyValue("--liquid-refraction-filter")).toBe(url)
    })
    it("ignores text changes and discovers new portals without scanning the document", () => {
        // Deliver observer records and frames explicitly. Native delivery is
        // verified by the Chrome probe; happy-dom can discard reentrant records.
        let notify: MutationCallback = () => {}
        const observer = { observe() {}, disconnect() {}, takeRecords: () => [] }
        vi.stubGlobal("MutationObserver", class {
            constructor(callback: MutationCallback) { notify = callback; return observer }
        })
        const mutate = (target: Node, addedNodes: Node[], removedNodes: Node[] = []) => notify([{
            target, addedNodes, removedNodes,
        } as unknown as MutationRecord], observer)
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length })
        const advanceFrame = () => { for (const frame of frames.splice(0)) frame(0) }
        const { defs, nav } = fixture()
        const label = document.createElement("span")
        nav.append(label)
        cleanup = mountLiquidRefraction(defs)
        const scanDocument = vi.spyOn(document, "querySelectorAll")
        const readStyle = vi.spyOn(window, "getComputedStyle")
        label.textContent = "Updated title"
        mutate(label, [...label.childNodes])
        expect(frames).toHaveLength(0)
        const portal = document.createElement("section")
        portal.dataset.liquidSurface = "panel"
        Object.defineProperties(portal, { offsetWidth: { value: 300 }, offsetHeight: { value: 200 } })
        document.body.append(portal)
        mutate(document.body, [portal])
        advanceFrame()
        expect(portal.dataset.liquidReady).toBe("true")
        expect(scanDocument.mock.calls.filter(([selector]) => /data-liquid-surface|floating-nav-island/.test(selector))).toHaveLength(0)
        expect(readStyle.mock.calls.every(([element]) => element === portal)).toBe(true)
        nav.append(portal)
        mutate(nav, [portal])
        advanceFrame()
        expect(portal.dataset.liquidReady).toBeUndefined()
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        document.body.append(portal)
        mutate(document.body, [portal])
        advanceFrame()
        expect(portal.dataset.liquidReady).toBe("true")
        expect(defs.querySelectorAll("filter")).toHaveLength(2)
        const panelFilter = defs.lastElementChild
        if (!panelFilter) throw new Error("Missing panel filter")
        const graph = Array.from(panelFilter.children)
        portal.dataset.liquidContext = "video"
        notify([{
            type: "attributes", target: portal, attributeName: "data-liquid-context", addedNodes: [], removedNodes: [],
        } as unknown as MutationRecord], observer)
        advanceFrame()
        expect(Array.from(panelFilter.children)).toEqual(graph)
        expect(panelFilter.querySelector('[result="backdrop"]')?.getAttribute("values")).toBe("1")
        portal.dataset.liquidSurface = "control"
        notify([{
            type: "attributes", target: portal, attributeName: "data-liquid-surface", addedNodes: [], removedNodes: [],
        } as unknown as MutationRecord], observer)
        advanceFrame()
        expect(portal.dataset.liquidReady).toBeUndefined()
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        portal.remove()
        mutate(document.body, [], [portal])
        advanceFrame()
        expect(defs.querySelectorAll("filter")).toHaveLength(1)
        expect(portal.dataset.liquidReady).toBeUndefined()
    })
})
