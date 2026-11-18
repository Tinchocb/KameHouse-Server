import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { collectEnterBlocks, staggerBlocksOf, staggerEnter } from "./enter-stagger"
import { NAV_DIM_OPACITY, entryStartOpacity } from "./navigation-transition"

const VIEWPORT = 900

/** Crea un hijo con alto y posición vertical simulados (jsdom no hace layout). */
function block(opts: { h: number; top?: number; position?: string; transform?: string; display?: string; children?: HTMLElement[] }) {
    const el = document.createElement("div")
    el.dataset.h = String(opts.h)
    el.dataset.top = String(opts.top ?? 0)
    if (opts.position) el.style.position = opts.position
    if (opts.transform) el.style.transform = opts.transform
    if (opts.display) el.style.display = opts.display
    opts.children?.forEach((c) => el.appendChild(c))
    return el
}

describe("collectEnterBlocks", () => {
    let original: typeof HTMLElement.prototype.getBoundingClientRect

    beforeEach(() => {
        original = HTMLElement.prototype.getBoundingClientRect
        HTMLElement.prototype.getBoundingClientRect = function () {
            const h = Number(this.dataset.h ?? 0)
            const top = Number(this.dataset.top ?? 0)
            return { top, bottom: top + h, height: h, left: 0, right: 100, width: 100, x: 0, y: top, toJSON() {} } as DOMRect
        }
    })

    afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = original
        document.body.innerHTML = ""
    })

    /** En el documento: getComputedStyle de un nodo suelto devuelve vacío. */
    const rootWith = (...children: HTMLElement[]) => {
        const root = document.createElement("div")
        children.forEach((c) => root.appendChild(c))
        document.body.appendChild(root)
        return root
    }

    it("toma los hijos visibles con altura suficiente, en orden", () => {
        const hero = block({ h: 800 })
        const body = block({ h: 2000, top: 820 })
        expect(collectEnterBlocks(rootWith(hero, body), VIEWPORT)).toEqual([hero, body])
    })

    it("ignora fondos fijos/absolutos, ocultos, bajos y los que framer-motion maneja", () => {
        const ok = block({ h: 500 })
        const root = rootWith(
            block({ h: 900, position: "fixed" }),
            block({ h: 900, position: "absolute" }),
            block({ h: 900, display: "none" }),
            block({ h: 10 }),
            block({ h: 500, transform: "translateY(4px)" }),
            ok,
            block({ h: 500, top: VIEWPORT + 50 }),
        )
        expect(collectEnterBlocks(root, VIEWPORT)).toEqual([ok])
    })

    it("con una sola envoltura alta baja un nivel para tener qué escalonar", () => {
        const a = block({ h: 120 })
        const b = block({ h: 3000, top: 130 })
        const wrapper = block({ h: 3200, children: [a, b] })
        expect(collectEnterBlocks(rootWith(wrapper), VIEWPORT)).toEqual([a, b])
    })

    it("si bajar un nivel no da al menos dos bloques, se queda con la envoltura", () => {
        const only = block({ h: 3000 })
        const wrapper = block({ h: 3200, children: [only] })
        expect(collectEnterBlocks(rootWith(wrapper), VIEWPORT)).toEqual([wrapper])
    })

    it("limita la cantidad de bloques escalonados", () => {
        const many = Array.from({ length: 7 }, () => block({ h: 100 }))
        expect(collectEnterBlocks(rootWith(...many), VIEWPORT)).toHaveLength(3)
    })
})

describe("staggerBlocksOf", () => {
    let original: typeof HTMLElement.prototype.getBoundingClientRect

    beforeEach(() => {
        original = HTMLElement.prototype.getBoundingClientRect
        HTMLElement.prototype.getBoundingClientRect = function () {
            const h = Number(this.dataset.h ?? 0)
            const top = Number(this.dataset.top ?? 0)
            return { top, bottom: top + h, height: h, left: 0, right: 100, width: 100, x: 0, y: top, toJSON() {} } as DOMRect
        }
    })

    afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = original
        document.body.innerHTML = ""
    })

    const rootWith = (...children: HTMLElement[]) => {
        const root = document.createElement("div")
        children.forEach((c) => root.appendChild(c))
        document.body.appendChild(root)
        return root
    }

    it("con un solo bloque no hay nada que escalonar", () => {
        expect(staggerBlocksOf(rootWith(block({ h: 800 })), VIEWPORT)).toEqual([])
    })

    it("con dos o más bloques devuelve los mismos que collectEnterBlocks", () => {
        const hero = block({ h: 800 })
        const body = block({ h: 2000, top: 820 })
        expect(staggerBlocksOf(rootWith(hero, body), VIEWPORT)).toEqual([hero, body])
    })
})

describe("staggerEnter", () => {
    /** jsdom no implementa WAAPI: el bloque guarda con qué keyframes y opciones se lo animaría. */
    function animatedBlock() {
        const el = document.createElement("div")
        const animate = vi.fn((_frames: Keyframe[], _options?: KeyframeAnimationOptions) => ({ cancel() {} }) as unknown as Animation)
        el.animate = animate as unknown as Element["animate"]
        return { el, animate }
    }

    it("el bloque 0 arranca en NAV_DIM_OPACITY (sin salida previa)", () => {
        const first = animatedBlock()
        const second = animatedBlock()
        staggerEnter([first.el, second.el], entryStartOpacity(null))
        expect(first.animate.mock.calls[0][0][0].opacity).toBe(NAV_DIM_OPACITY)
        expect(second.animate.mock.calls[0][0][0].opacity).toBe(0)
    })

    it("el bloque 0 continúa desde la opacidad de la salida cuando esta fue más alta", () => {
        const first = animatedBlock()
        const second = animatedBlock()
        staggerEnter([first.el, second.el], entryStartOpacity(0.9))
        expect(first.animate.mock.calls[0][0][0].opacity).toBe(0.9)
    })

    it("los bloques siguientes se escalonan: arrancan después que el primero", () => {
        const first = animatedBlock()
        const second = animatedBlock()
        staggerEnter([first.el, second.el], NAV_DIM_OPACITY)
        expect(first.animate.mock.calls[0][1]?.delay).toBe(0)
        expect(second.animate.mock.calls[0][1]?.delay).toBeGreaterThan(0)
    })
})
