import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useUIStore } from "@/lib/store"
import { useNavCompact } from "./use-nav-compact"

// Las islas de la barra (marca, navegación) comparten este hook: una sola señal de scroll
// con histéresis, y se abren juntas con el puntero o el foco de teclado.
describe("useNavCompact", () => {
    let scroller: HTMLDivElement
    let scrollTop = 0

    // requestAnimationFrame a mano: el hook guarda el id del cuadro pendiente, así que el callback
    // no puede correr dentro de la propia llamada.
    let frames: FrameRequestCallback[] = []
    const flushFrames = () => {
        const run = frames
        frames = []
        run.forEach((cb) => cb(0))
    }

    const scrollTo = (y: number) => {
        scrollTop = y
        act(() => {
            scroller.dispatchEvent(new Event("scroll"))
            flushFrames()
        })
    }

    beforeEach(() => {
        scrollTop = 0
        useUIStore.getState().setNavDensity("auto")
        frames = []
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            frames.push(cb)
            return frames.length
        })
        vi.stubGlobal("cancelAnimationFrame", () => {})
        scroller = document.createElement("div")
        scroller.setAttribute("data-scroll-container", "true")
        Object.defineProperty(scroller, "scrollTop", { get: () => scrollTop, configurable: true })
        document.body.appendChild(scroller)
    })

    afterEach(() => {
        scroller.remove()
        vi.unstubAllGlobals()
    })

    it("se compacta al bajar y se expande al subir, con histéresis", () => {
        const { result } = renderHook(() => useNavCompact())
        expect(result.current.compact).toBe(false)
        scrollTo(60)
        scrollTo(140)
        expect(result.current.compact).toBe(true)
        // Un retroceso chico no la abre
        scrollTo(130)
        expect(result.current.compact).toBe(true)
        scrollTo(100)
        expect(result.current.compact).toBe(false)
    })

    it("ignora el scroll de listas que no son la página", () => {
        const { result } = renderHook(() => useNavCompact())
        const list = document.createElement("div")
        Object.defineProperty(list, "scrollTop", { get: () => 500, configurable: true })
        document.body.appendChild(list)
        act(() => {
            list.dispatchEvent(new Event("scroll"))
            flushFrames()
        })
        expect(result.current.compact).toBe(false)
        list.remove()
    })

    it("se abre con el puntero encima y vuelve a compactarse al salir", () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
        const { result } = renderHook(() => useNavCompact())
        scrollTo(60)
        scrollTo(140)
        expect(result.current.compact).toBe(true)
        act(() => result.current.handlers.onPointerEnter({ pointerType: "mouse" } as never))
        expect(result.current.compact).toBe(false)
        act(() => result.current.handlers.onPointerLeave())
        act(() => {
            vi.advanceTimersByTime(300)
        })
        expect(result.current.compact).toBe(true)
        vi.useRealTimers()
    })

    it("un toque con el dedo no deja la barra abierta", () => {
        const { result } = renderHook(() => useNavCompact())
        scrollTo(60)
        scrollTo(140)
        act(() => result.current.handlers.onPointerEnter({ pointerType: "touch" } as never))
        expect(result.current.compact).toBe(true)
    })

    it("Expandida nunca se compacta y Compacta lo está siempre", () => {
        const { result } = renderHook(() => useNavCompact())
        act(() => useUIStore.getState().setNavDensity("expanded"))
        scrollTo(60)
        scrollTo(140)
        expect(result.current.compact).toBe(false)
        act(() => useUIStore.getState().setNavDensity("compact"))
        expect(result.current.compact).toBe(true)
    })
})
