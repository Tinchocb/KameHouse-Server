import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DeferredMount } from "./deferred-mount"

describe("DeferredMount", () => {
    let queue: FrameRequestCallback[]

    beforeEach(() => {
        queue = []
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            queue.push(cb)
            return queue.length
        })
        vi.stubGlobal("cancelAnimationFrame", () => {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    /** Corre los rAF pendientes (y los que encolen), como el navegador cuadro a cuadro. */
    const flushFrames = () => {
        act(() => {
            while (queue.length) queue.shift()?.(0)
        })
    }

    it("no monta el contenido en el primer render y lo monta tras dos cuadros", () => {
        render(<DeferredMount heightKey="t-1"><p>contenido pesado</p></DeferredMount>)
        expect(screen.queryByText("contenido pesado")).toBeNull()
        flushFrames()
        expect(screen.getByText("contenido pesado")).toBeTruthy()
    })

    it("reserva el alto de reserva mientras espera", () => {
        const { container } = render(<DeferredMount heightKey="t-2" fallbackHeight={420}><p>x</p></DeferredMount>)
        expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("420px")
        flushFrames()
        expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("")
    })

    it("aplica la clase al contenedor para que el contenido conserve su layout", () => {
        const { container } = render(<DeferredMount heightKey="t-3" className="space-y-8"><p>a</p><p>b</p></DeferredMount>)
        flushFrames()
        expect(container.firstElementChild?.className).toBe("space-y-8")
        expect(container.firstElementChild?.children.length).toBe(2)
    })

    it("sigue montado al re-renderizar con otros hijos", () => {
        const { rerender } = render(<DeferredMount heightKey="t-4"><p>uno</p></DeferredMount>)
        flushFrames()
        rerender(<DeferredMount heightKey="t-4"><p>dos</p></DeferredMount>)
        expect(screen.getByText("dos")).toBeTruthy()
    })

    describe("visibilidad al entrar", () => {
        // Solo este espía: restoreAllMocks también reinicia el mock global de ResizeObserver del setup.
        let rectSpy: ReturnType<typeof vi.spyOn> | null = null
        afterEach(() => {
            rectSpy?.mockRestore()
            rectSpy = null
        })
        const stubTop = (top: number) => {
            rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 100, height: 100, left: 0, right: 1, width: 1, x: 0, y: top, toJSON() {} } as DOMRect)
            vi.stubGlobal("innerHeight", 900)
        }
        const startEntering = () => {
            const m = document.createElement("div")
            m.setAttribute("data-page-entering", "")
            document.body.appendChild(m)
            return m
        }

        it("un bloque que ya se ve al entrar se monta sin esperar el fin de la entrada", () => {
            stubTop(500)
            const marker = startEntering()
            render(<DeferredMount heightKey="t-5"><p>visible</p></DeferredMount>)
            flushFrames()
            expect(screen.getByText("visible")).toBeTruthy()
            marker.remove()
        })

        it("un bloque que queda bajo el pliegue espera el fin de la entrada", () => {
            stubTop(850)
            const marker = startEntering()
            render(<DeferredMount heightKey="t-6"><p>abajo</p></DeferredMount>)
            flushFrames()
            expect(screen.queryByText("abajo")).toBeNull()
            act(() => { window.dispatchEvent(new Event("kh:page-entered")) })
            expect(screen.getByText("abajo")).toBeTruthy()
            marker.remove()
        })
    })

    it("con immediate monta el contenido desde el primer render, sin cuadros", () => {
        render(<DeferredMount heightKey="t-7" immediate><p>ya</p></DeferredMount>)
        expect(screen.getByText("ya")).toBeTruthy()
        expect(queue.length).toBe(0)
    })

    it("avisa con onMount una sola vez al montarse el contenido", () => {
        const onMount = vi.fn()
        const { rerender } = render(<DeferredMount heightKey="t-8" onMount={onMount}><p>uno</p></DeferredMount>)
        expect(onMount).not.toHaveBeenCalled()
        flushFrames()
        expect(onMount).toHaveBeenCalledTimes(1)
        rerender(<DeferredMount heightKey="t-8" onMount={onMount}><p>dos</p></DeferredMount>)
        expect(onMount).toHaveBeenCalledTimes(1)
    })

    it("con immediate avisa onMount en el primer montaje", () => {
        const onMount = vi.fn()
        render(<DeferredMount heightKey="t-9" immediate onMount={onMount}><p>x</p></DeferredMount>)
        expect(onMount).toHaveBeenCalledTimes(1)
    })
})
