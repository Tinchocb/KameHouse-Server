import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useHeroParallax } from "./use-hero"

// React 19: habilita act() fuera de testing-library.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Hero({ maxOffset }: { maxOffset?: number }) {
    const ref = useHeroParallax(0.15, { maxOffset })
    return (
        <div data-testid="scroller" style={{ overflowY: "auto" }}>
            {/* Otro contenedor con scroll dentro del mismo árbol (swimlane / drag) */}
            <div data-testid="inner" style={{ overflowX: "auto" }}>
                <div ref={ref} data-testid="layer" />
            </div>
        </div>
    )
}

const frame = () => new Promise(r => setTimeout(r, 0))

describe("useHeroParallax", () => {
    let host: HTMLDivElement
    let root: Root

    beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
        vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
        host = document.createElement("div")
        document.body.appendChild(host)
        root = createRoot(host)
    })

    afterEach(() => {
        act(() => root.unmount())
        host.remove()
        vi.unstubAllGlobals()
    })

    async function mount(maxOffset?: number) {
        await act(async () => root.render(<Hero maxOffset={maxOffset} />))
        const scroller = host.querySelector<HTMLElement>("[data-testid=scroller]")
        const inner = host.querySelector<HTMLElement>("[data-testid=inner]")
        const layer = host.querySelector<HTMLElement>("[data-testid=layer]")
        if (!scroller || !inner || !layer) throw new Error("Missing test fixtures")
        Object.defineProperty(scroller, "scrollHeight", { value: 2000 })
        Object.defineProperty(scroller, "clientHeight", { value: 800 })
        return { scroller, inner, layer }
    }

    async function scroll(el: HTMLElement, top?: number) {
        if (top != null) el.scrollTop = top
        el.dispatchEvent(new Event("scroll"))
        await act(frame)
    }

    it("tops the offset at maxOffset so the overscan is never exceeded", async () => {
        const { scroller, layer } = await mount(40)
        await scroll(scroller, 100)
        expect(layer.style.transform).toBe("translate3d(0, 15px, 0)")
        await scroll(scroller, 600)
        expect(layer.style.transform).toBe("translate3d(0, 40px, 0)")
    })

    it("returns exactly to 0 when scrolling back to the top", async () => {
        const { scroller, layer } = await mount(40)
        await scroll(scroller, 200)
        await scroll(scroller, 0)
        expect(layer.style.transform).toBe("translate3d(0, 0px, 0)")
    })

    it("ignores the scroll position of other containers in the same frame", async () => {
        const { scroller, inner, layer } = await mount(40)
        scroller.scrollTop = 200
        // Un scroll horizontal del contenedor interno llega primero en el frame.
        inner.dispatchEvent(new Event("scroll"))
        await scroll(scroller)
        expect(layer.style.transform).toBe("translate3d(0, 30px, 0)")
    })
})
