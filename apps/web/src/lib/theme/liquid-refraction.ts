/** Geometry for a procedural rounded lens, measured in CSS pixels. */
type LensOptions = { surface?: "navigation" | "panel"; video?: boolean }
export const MAX_LIQUID_LENSES = 8

export function createRefractionProfile(width: number, height: number, radius: number, pixelRatio = 1, options: LensOptions = {}) {
    const corner = Math.max(0, Math.min(radius, width / 2, height / 2))
    const edge = Math.max(1.5, Math.min(4, Math.min(width, height) / 16))
    const rounding = Math.max(0.1, corner * 0.65)
    const panel = options.surface === "panel"
    const blur = options.video ? (panel ? 2 : 1) : 3
    return {
        width, height, rounding, edge,
        padding: Math.ceil(Math.max(rounding * 3, edge * 4)),
        scale: Math.min(options.video && panel ? 24 : 36, Math.min(width, height) * (panel ? 0.45 : 0.6)),
        blur, guard: blur * 3, saturation: options.video ? 1 : 1.25,
        // The derivative runs in device pixels. Normalize its amplitude so the
        // lens keeps the same optical thickness on high-density screens.
        divisor: 8 / (Math.sqrt(2 * Math.PI) * edge * Math.max(1, pixelRatio) * 0.45),
    }
}

const NS = "http://www.w3.org/2000/svg"
const SELECTOR = '.floating-nav-island, [data-liquid-surface="navigation"], [data-liquid-surface="panel"]'
let nextId = 0
const lensUpdates = new WeakMap<SVGFilterElement, (profile: ReturnType<typeof createRefractionProfile>) => void>()

function primitive(name: string, attributes: Record<string, string | number>) {
    const node = document.createElementNS(NS, name)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
    return node
}

/** Generate the lens inside the filter. feImage can produce a blank image in
 * Chromium's backdrop pipeline, causing a constant offset instead of a lens.
 * Derivatives of an opaque rounded mask avoid that image-loading path. */
function buildLens(filter: SVGFilterElement, width: number, height: number, radius: number, options: LensOptions) {
    const p = createRefractionProfile(width, height, radius, window.devicePixelRatio, options)
    filter.setAttribute("filterUnits", "userSpaceOnUse")
    filter.setAttribute("primitiveUnits", "userSpaceOnUse")
    filter.setAttribute("x", String(-p.padding))
    filter.setAttribute("y", String(-p.padding))
    filter.setAttribute("width", String(width + p.padding * 2))
    filter.setAttribute("height", String(height + p.padding * 2))
    const update = lensUpdates.get(filter)
    if (update) {
        update(p)
        return
    }
    const matrix = (input: string, values: string, result: string) =>
        primitive("feColorMatrix", { in: input, type: "matrix", values, result })
    const derivative = (kernel: string, result: string) => primitive("feConvolveMatrix", {
        in: "bevel", order: 3, kernelMatrix: kernel, divisor: p.divisor,
        bias: 0.5, preserveAlpha: "true", edgeMode: "duplicate", result,
    })
    // The mask needs padding to round its corners; the live backdrop does not.
    // Only the rounding mask needs broad padding. Live pixels need 3σ of blur.
    const backdropRegion = { x: -p.guard, y: -p.guard, width: width + p.guard * 2, height: height + p.guard * 2 }
    const box = primitive("feFlood", { x: 0, y: 0, width, height, "flood-color": "white", result: "box" })
    const rounding = primitive("feGaussianBlur", { in: "silhouette", stdDeviation: p.rounding, result: "rounded" })
    const bevel = primitive("feGaussianBlur", { in: "shape", stdDeviation: p.edge, result: "softBevel" })
    const derivatives = [derivative("1 0 -1 2 0 -2 1 0 -1", "horizontal"), derivative("1 2 1 0 0 0 -1 -2 -1", "vertical")]
    const backdropPasses = [
        primitive("feGaussianBlur", { ...backdropRegion, in: "SourceGraphic", stdDeviation: p.blur, result: "softBackdrop" }),
        primitive("feColorMatrix", { ...backdropRegion, in: "softBackdrop", type: "saturate", values: p.saturation, result: "backdrop" }),
    ]
    const displacement = primitive("feDisplacementMap", { x: 0, y: 0, width, height, in: "backdrop", in2: "lens", scale: p.scale, xChannelSelector: "R", yChannelSelector: "G" })
    filter.replaceChildren(
        primitive("feFlood", { "flood-color": "black", result: "outside" }),
        box,
        primitive("feComposite", { in: "box", in2: "outside", operator: "over", result: "silhouette" }),
        rounding,
        // A steep clamped transfer rounds the box. Constant alpha prevents
        // transparent filter-region boundaries from contaminating derivatives.
        matrix("rounded", "60 0 0 0 -29.5  60 0 0 0 -29.5  60 0 0 0 -29.5  0 0 0 0 1", "shape"),
        bevel,
        matrix("softBevel", "1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1", "bevel"),
        ...derivatives,
        matrix("horizontal", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1", "red"),
        matrix("vertical", "0 0 0 0 0  1 0 0 0 0  0 0 0 0 0  0 0 0 0 1", "green"),
        primitive("feComposite", { in: "red", in2: "green", operator: "arithmetic", k2: 1, k3: 1, result: "lens" }),
        // All optical operations stay inside the reference filter. Appending
        // CSS blur() after url() can discard displacement in Chromium.
        ...backdropPasses,
        displacement,
    )
    // Keep the graph and its URLs stable while the navigation expands or a
    // dialog resizes. Only geometry changes; no SVG subtree is reconstructed.
    lensUpdates.set(filter, next => {
        box.setAttribute("width", String(next.width))
        box.setAttribute("height", String(next.height))
        rounding.setAttribute("stdDeviation", String(next.rounding))
        bevel.setAttribute("stdDeviation", String(next.edge))
        for (const derivative of derivatives) derivative.setAttribute("divisor", String(next.divisor))
        displacement.setAttribute("scale", String(next.scale))
        displacement.setAttribute("width", String(next.width))
        displacement.setAttribute("height", String(next.height))
        for (const pass of backdropPasses) {
            pass.setAttribute("x", String(-next.guard))
            pass.setAttribute("y", String(-next.guard))
            pass.setAttribute("width", String(next.width + next.guard * 2))
            pass.setAttribute("height", String(next.height + next.guard * 2))
        }
        backdropPasses[0].setAttribute("stdDeviation", String(next.blur))
        backdropPasses[1].setAttribute("values", String(next.saturation))
    })
}

function isOptical(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false
    const role = element.dataset.liquidSurface
    return role ? role === "navigation" || role === "panel" : element.classList.contains("floating-nav-island")
}
function hasOpticalAncestor(element: Element): boolean {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (isOptical(parent)) return true
    }
    return false
}
interface LensMeasurement {
    width: number; height: number; radius: number; options: LensOptions; key: string
}
interface LensState {
    filter: SVGFilterElement | null
    builtKey: string
    visible: boolean
    intersectionKnown: boolean
    measurement: LensMeasurement | null
}

/** Incremental discovery, one read/write batch, and a hard budget for live
 * lenses. Lightweight content/control materials never enter this registry. */
export function mountLiquidRefraction(defs: SVGDefsElement) {
    const surfaces = new Map<HTMLElement, LensState>()
    const added = new Set<Element>()
    const dirty = new Set<HTMLElement>()
    let frame = 0
    let disposed = false
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(flush) }
    const resize = new ResizeObserver(entries => {
        for (const entry of entries) dirty.add(entry.target as HTMLElement)
        schedule()
    })
    const intersection = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
        let changed = false
        for (const entry of entries) {
            const state = surfaces.get(entry.target as HTMLElement)
            if (!state) continue
            const visible = entry.isIntersecting
            state.intersectionKnown = true
            if (state.visible !== visible) {
                state.visible = visible
                // Re-read geometry on entry; offscreen elements require no style reads.
                if (visible) dirty.add(entry.target as HTMLElement)
                changed = true
            }
        }
        if (changed) schedule()
    })
    function deactivate(element: HTMLElement, state: LensState) {
        state.filter?.remove()
        if (element.dataset.liquidReady) {
            element.style.removeProperty("--liquid-refraction-filter")
            delete element.dataset.liquidReady
        }
    }
    function release(element: HTMLElement, state: LensState) {
        resize.unobserve(element)
        intersection?.unobserve(element)
        deactivate(element, state)
        dirty.delete(element)
        surfaces.delete(element)
    }
    function register(element: Element) {
        if (!(element instanceof HTMLElement) || !isOptical(element) || !element.isConnected || hasOpticalAncestor(element)) return
        if (!surfaces.has(element)) {
            surfaces.set(element, { filter: null, builtKey: "", visible: false, intersectionKnown: false, measurement: null })
            resize.observe(element)
            intersection?.observe(element)
        }
        dirty.add(element)
    }
    function flush() {
        frame = 0
        if (disposed) return
        for (const [element, state] of surfaces) {
            if (!element.isConnected || !isOptical(element) || hasOpticalAncestor(element)) release(element, state)
        }
        for (const root of added) {
            if (!root.isConnected) continue
            let covered = false
            for (let parent = root.parentElement; parent; parent = parent.parentElement) {
                if (added.has(parent)) { covered = true; break }
            }
            if (covered) continue
            register(root)
            for (const element of root.querySelectorAll(SELECTOR)) register(element)
        }
        added.clear()
        // Complete all layout/style reads before changing SVG nodes or surface styles.
        for (const element of dirty) {
            const state = surfaces.get(element)
            if (!state) continue
            const width = element.offsetWidth, height = element.offsetHeight
            if (!width || !height) { state.measurement = null; continue }
            if (!state.intersectionKnown) {
                const rect = element.getBoundingClientRect()
                state.visible = rect.top < window.innerHeight && rect.left < window.innerWidth
                    && rect.top + (rect.height || height) > 0 && rect.left + (rect.width || width) > 0
            }
            if (!state.visible) continue
            const raw = getComputedStyle(element).borderTopLeftRadius
            const radius = raw.endsWith("%") ? Math.min(width, height) * parseFloat(raw) / 100 : parseFloat(raw) || 0
            const options: LensOptions = {
                surface: element.dataset.liquidSurface === "panel" ? "panel" : "navigation",
                video: !!element.closest('[data-liquid-context="video"]'),
            }
            const key = `${width}:${height}:${radius}:${window.devicePixelRatio}:${options.surface}:${options.video}`
            state.measurement = { width, height, radius, options, key }
        }
        dirty.clear()
        const focus = document.activeElement
        const eligible = [...surfaces].filter(([, state]) => state.visible && state.measurement)
        const rank = ([element, state]: [HTMLElement, LensState]) =>
            focus && element.contains(focus) ? 0 : state.measurement?.options.surface === "panel" ? 1 : 2
        eligible.sort((a, b) => rank(a) - rank(b))
        const selected = new Set(eligible.slice(0, MAX_LIQUID_LENSES).map(([element]) => element))
        for (const [element, state] of surfaces) {
            if (!selected.has(element)) deactivate(element, state)
        }
        const fragment = document.createDocumentFragment()
        for (const [element, state] of eligible.slice(0, MAX_LIQUID_LENSES)) {
            const measurement = state.measurement
            if (!measurement) continue
            if (!state.filter) {
                state.filter = document.createElementNS(NS, "filter")
                state.filter.id = `kh-liquid-${++nextId}`
                state.filter.setAttribute("color-interpolation-filters", "sRGB")
            }
            if (state.builtKey !== measurement.key) {
                buildLens(state.filter, measurement.width, measurement.height, measurement.radius, measurement.options)
                state.builtKey = measurement.key
            }
            if (!state.filter.isConnected) fragment.append(state.filter)
            if (!element.dataset.liquidReady) {
                element.style.setProperty("--liquid-refraction-filter", `url("#${state.filter.id}")`)
                element.dataset.liquidReady = "true"
            }
        }
        if (fragment.childNodes.length) defs.append(fragment)
    }
    const observer = new MutationObserver(records => {
        let changed = false
        for (const record of records) {
            if (record.target === defs || defs.contains(record.target)) continue
            if (record.type === "attributes" && record.target instanceof Element) {
                added.add(record.target)
                // A context marker may be on the surface or on its portal root.
                for (const element of surfaces.keys()) {
                    if (record.target.contains(element)) dirty.add(element)
                }
                changed = true
                continue
            }
            for (const node of record.addedNodes) {
                if (node instanceof Element) { added.add(node); changed = true }
            }
            if (!changed && record.removedNodes.length > 0 && surfaces.size > 0) {
                for (const element of surfaces.keys()) {
                    if (!element.isConnected) {
                        changed = true
                        break
                    }
                }
            }
        }
        if (changed) schedule()
    })
    observer.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["data-liquid-surface", "data-liquid-context"],
    })
    let pixelRatio = window.devicePixelRatio
    const refreshDensity = () => {
        if (pixelRatio === window.devicePixelRatio) return
        pixelRatio = window.devicePixelRatio
        for (const element of surfaces.keys()) dirty.add(element)
        schedule()
    }
    const refreshVisibility = () => {
        for (const [element, state] of surfaces) { state.intersectionKnown = false; dirty.add(element) }
        schedule()
    }
    const onFocusChange = () => {
        // El foco solo reasigna presupuesto cuando hay más superficies que lentes disponibles.
        if (surfaces.size > MAX_LIQUID_LENSES) schedule()
    }
    window.addEventListener("resize", refreshDensity)
    document.addEventListener("focusin", onFocusChange)
    document.addEventListener("focusout", onFocusChange)
    if (!intersection) window.addEventListener("scroll", refreshVisibility, { capture: true, passive: true })
    added.add(document.body)
    flush()
    return () => {
        disposed = true
        cancelAnimationFrame(frame)
        observer.disconnect()
        resize.disconnect()
        intersection?.disconnect()
        window.removeEventListener("resize", refreshDensity)
        document.removeEventListener("focusin", onFocusChange)
        document.removeEventListener("focusout", onFocusChange)
        if (!intersection) window.removeEventListener("scroll", refreshVisibility, { capture: true })
        for (const [element, state] of surfaces) release(element, state)
        added.clear()
        dirty.clear()
    }
}
