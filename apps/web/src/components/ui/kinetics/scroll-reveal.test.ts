import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// IntersectionObserver controlable: guarda el callback y los elementos observados.
let ioCallback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null
const observed = new Set<Element>()
class FakeIO {
    constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) { ioCallback = cb }
    observe(el: Element) { observed.add(el) }
    unobserve(el: Element) { observed.delete(el) }
    disconnect() { observed.clear() }
}
vi.stubGlobal("IntersectionObserver", FakeIO)

import { observeRevealBatched, readingOrder, revealConfigForTier, type RevealConfig } from "./scroll-reveal"
import { scrollProgress } from "./scroll-progress"

const FULL = revealConfigForTier("full") as RevealConfig

function el(top: number, left = 0): HTMLElement {
    const e = document.createElement("div")
    document.body.appendChild(e)
    const rect = { top, left, bottom: top + 100, right: left + 100, width: 100, height: 100, x: left, y: top, toJSON() {} }
    e.getBoundingClientRect = () => rect as DOMRect
    return e
}

function intersect(...els: HTMLElement[]) {
    ioCallback?.(els.map((target) => ({ target, isIntersecting: true, boundingClientRect: target.getBoundingClientRect() })))
}

describe("scroll reveal", () => {
    it("cancels the fallback timer when opacity finishes", async () => {
        const element = el(1200)
        observeRevealBatched(element, FULL)
        await Promise.resolve()
        intersect(element)
        expect(vi.getTimerCount()).toBe(1)
        const end = new Event("transitionend")
        Object.defineProperty(end, "propertyName", { value: "opacity" })
        element.dispatchEvent(end)
        expect(vi.getTimerCount()).toBe(0)
        expect(element.style.transition).toBe("")
    })
    it("releases an active animation and its timer on unmount", async () => {
        const element = el(1200)
        const release = observeRevealBatched(element, FULL)
        await Promise.resolve()
        intersect(element)
        release()
        expect(vi.getTimerCount()).toBe(0)
        expect(element.style.transition).toBe("")
    })
    it("an old release cannot clear a reused node's new animation", async () => {
        const element = el(1200)
        const oldRelease = observeRevealBatched(element, FULL)
        await Promise.resolve()
        intersect(element)
        vi.advanceTimersByTime(200)
        const newRelease = observeRevealBatched(element, { ...FULL, duration: 900 })
        await Promise.resolve()
        intersect(element)
        const transition = element.style.transition
        oldRelease()
        vi.advanceTimersByTime(FULL.duration + 80 - 200)
        expect(element.style.transition).toBe(transition)
        expect(vi.getTimerCount()).toBe(1)
        newRelease()
        expect(vi.getTimerCount()).toBe(0)
    })
    it("preserves a transition subsequently installed by another owner", async () => {
        const element = el(1200)
        const release = observeRevealBatched(element, FULL)
        await Promise.resolve()
        intersect(element)
        element.style.transition = "color 100ms linear"
        release()
        expect(element.style.transition).toBe("color 100ms linear")
        expect(vi.getTimerCount()).toBe(0)
    })
    it("commits one layout read for an entire entering batch", async () => {
        const elements = Array.from({ length: 30 }, (_, i) => el(1200 + i * 100))
        let reads = 0
        for (const element of elements) {
            Object.defineProperty(element, "offsetWidth", { get: () => { reads++; return 100 } })
            observeRevealBatched(element, FULL)
        }
        await Promise.resolve()
        intersect(...elements)
        expect(reads).toBe(1)
        expect(elements.every(element => element.style.opacity === "")).toBe(true)
    })
    beforeEach(() => {
        vi.useFakeTimers()
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
        document.body.innerHTML = ""
        observed.clear()
    })
    afterEach(() => vi.useRealTimers())

    it("no anima lo que ya está en pantalla al montar", async () => {
        const visible = el(100)
        observeRevealBatched(visible, FULL)
        await Promise.resolve()
        expect(visible.style.opacity).toBe("")
        expect(observed.has(visible)).toBe(false)
    })

    it("oculta lo que está abajo y lo revela al entrar, escalonado en orden de lectura", async () => {
        const a = el(1200, 300)
        const b = el(1200, 0)
        const c = el(1500, 0)
        for (const e of [a, b, c]) observeRevealBatched(e, FULL)
        await Promise.resolve()
        expect(a.style.opacity).toBe("0")
        expect(a.style.transform).toContain("18px")

        intersect(a, c, b) // llegan desordenados
        expect(b.style.transition).toContain(" 0ms")   // primero: izquierda de la fila de arriba
        expect(a.style.transition).toContain(" 45ms")
        expect(c.style.transition).toContain(" 90ms")
        expect(a.style.opacity).toBe("")
        expect(observed.size).toBe(0)

        vi.advanceTimersByTime(FULL.duration + 200)
        expect(a.style.transition).toBe("") // limpia: el hover vuelve a controlar transform
    })

    it("el retraso tiene tope", async () => {
        const many = Array.from({ length: 20 }, (_, i) => el(1200 + i * 120))
        for (const e of many) observeRevealBatched(e, FULL)
        await Promise.resolve()
        intersect(...many)
        expect(many[19].style.transition).toContain(` ${FULL.maxDelay}ms`)
    })

    it("un contenedor altísimo se revela con un tramo visible, aunque no llegue al 8 % de su alto", async () => {
        const tall = el(1200)
        observeRevealBatched(tall, FULL)
        await Promise.resolve()
        const entry = (ratio: number, visible: number) => ({
            target: tall, isIntersecting: true, boundingClientRect: tall.getBoundingClientRect(),
            intersectionRatio: ratio, intersectionRect: { height: visible } as DOMRectReadOnly,
        })
        // Asoma apenas (ratio 0,0001, 2 px): todavía no.
        ioCallback?.([entry(0.0001, 2)])
        expect(tall.style.opacity).toBe("0")
        // Un tramo de 90 px de un contenedor de 18 000 px (0,5 %): ya se revela.
        ioCallback?.([entry(0.005, 90)])
        expect(tall.style.opacity).toBe("")
        expect(observed.has(tall)).toBe(false)
    })

    it("la baja restaura el elemento", async () => {
        const e = el(2000)
        const release = observeRevealBatched(e, FULL)
        await Promise.resolve()
        release()
        expect(e.style.opacity).toBe("")
        expect(observed.has(e)).toBe(false)
    })

    it("respeta el nivel de movimiento", () => {
        expect(revealConfigForTier("off")).toBeNull()
        expect(revealConfigForTier("subtle")?.y).toBe(0)
    })

    it("readingOrder ordena por fila y después por columna", () => {
        const r = (top: number, left: number) => ({ top, left } as DOMRectReadOnly)
        expect(readingOrder(r(100, 500), r(104, 0))).toBeGreaterThan(0) // misma fila: gana la izquierda
        expect(readingOrder(r(100, 0), r(300, 0))).toBeLessThan(0)
    })
})

describe("scrollProgress", () => {
    it("va de 0 a 1 y se limita", () => {
        expect(scrollProgress(0, 2000, 1000)).toBe(0)
        expect(scrollProgress(500, 2000, 1000)).toBe(0.5)
        expect(scrollProgress(5000, 2000, 1000)).toBe(1)
        expect(scrollProgress(0, 800, 1000)).toBe(0)
    })
})

describe("scroll reveal con clave", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
        document.body.innerHTML = ""
        observed.clear()
    })
    afterEach(() => vi.useRealTimers())

    it("un ítem ya revelado no se vuelve a animar al remontarse (listas virtualizadas)", async () => {
        const first = el(1500)
        observeRevealBatched(first, FULL, "ep:1:5")
        await Promise.resolve()
        intersect(first)
        const remount = el(1500)
        observeRevealBatched(remount, FULL, "ep:1:5")
        await Promise.resolve()
        expect(remount.style.opacity).toBe("")
        expect(observed.has(remount)).toBe(false)
    })

    it("lo que se vio al montar cuenta como revelado", async () => {
        observeRevealBatched(el(100), FULL, "ep:1:1")
        await Promise.resolve()
        const remount = el(1500)
        observeRevealBatched(remount, FULL, "ep:1:1")
        await Promise.resolve()
        expect(remount.style.opacity).toBe("")
    })
})

describe("registro por lotes (useRevealRef)", () => {
    beforeEach(() => {
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
        document.body.innerHTML = ""
        observed.clear()
    })

    it("resuelve el registro después del commit, con el mismo resultado que el registro directo", async () => {
        const visible = el(100)
        const below = el(1500)
        observeRevealBatched(visible, FULL)
        observeRevealBatched(below, FULL)
        // Antes del microtask no se tocó nada (el commit no paga lecturas ni escrituras).
        expect(below.style.opacity).toBe("")
        await Promise.resolve()
        expect(visible.style.opacity).toBe("")
        expect(observed.has(visible)).toBe(false)
        expect(below.style.opacity).toBe("0")
        expect(observed.has(below)).toBe(true)
    })

    it("lee todas las posiciones antes de escribir estilos", async () => {
        const els = [el(1200), el(1300), el(1400)]
        const log: string[] = []
        for (const e of els) {
            const rectFn = e.getBoundingClientRect
            e.getBoundingClientRect = () => { log.push("lee"); return rectFn.call(e) }
            const style = e.style
            let opacity = ""
            Object.defineProperty(style, "opacity", { configurable: true, get: () => opacity, set: (v: string) => { log.push("escribe"); opacity = v } })
        }
        for (const e of els) observeRevealBatched(e, FULL)
        await Promise.resolve()
        expect(log).toEqual(["lee", "lee", "lee", "escribe", "escribe", "escribe"])
    })

    it("dar de baja antes del microtask evita el registro", async () => {
        const below = el(1500)
        const release = observeRevealBatched(below, FULL)
        release()
        await Promise.resolve()
        expect(below.style.opacity).toBe("")
        expect(observed.has(below)).toBe(false)
    })

    it("dar de baja después del registro limpia estilos y observador", async () => {
        const below = el(1500)
        const release = observeRevealBatched(below, FULL)
        await Promise.resolve()
        expect(below.style.opacity).toBe("0")
        release()
        expect(below.style.opacity).toBe("")
        expect(observed.has(below)).toBe(false)
    })
})
