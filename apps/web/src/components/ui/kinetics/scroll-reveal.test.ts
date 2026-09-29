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

import { observeReveal, readingOrder, revealConfigForTier, type RevealConfig } from "./scroll-reveal"
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
    beforeEach(() => {
        vi.useFakeTimers()
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 })
        document.body.innerHTML = ""
        observed.clear()
    })
    afterEach(() => vi.useRealTimers())

    it("no anima lo que ya está en pantalla al montar", () => {
        const visible = el(100)
        observeReveal(visible, FULL)
        expect(visible.style.opacity).toBe("")
        expect(observed.has(visible)).toBe(false)
    })

    it("oculta lo que está abajo y lo revela al entrar, escalonado en orden de lectura", () => {
        const a = el(1200, 300)
        const b = el(1200, 0)
        const c = el(1500, 0)
        for (const e of [a, b, c]) observeReveal(e, FULL)
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

    it("el retraso tiene tope", () => {
        const many = Array.from({ length: 20 }, (_, i) => el(1200 + i * 120))
        for (const e of many) observeReveal(e, FULL)
        intersect(...many)
        expect(many[19].style.transition).toContain(` ${FULL.maxDelay}ms`)
    })

    it("la baja restaura el elemento", () => {
        const e = el(2000)
        const release = observeReveal(e, FULL)
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

    it("un ítem ya revelado no se vuelve a animar al remontarse (listas virtualizadas)", () => {
        const first = el(1500)
        observeReveal(first, FULL, "ep:1:5")
        intersect(first)
        const remount = el(1500)
        observeReveal(remount, FULL, "ep:1:5")
        expect(remount.style.opacity).toBe("")
        expect(observed.has(remount)).toBe(false)
    })

    it("lo que se vio al montar cuenta como revelado", () => {
        observeReveal(el(100), FULL, "ep:1:1")
        const remount = el(1500)
        observeReveal(remount, FULL, "ep:1:1")
        expect(remount.style.opacity).toBe("")
    })
})
