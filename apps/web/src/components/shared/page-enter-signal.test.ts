import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PAGE_ENTERED_EVENT, PAGE_ENTERING_ATTR, whenPageEntered } from "./page-enter-signal"

describe("whenPageEntered", () => {
    let marker: HTMLElement | null = null

    const startEntering = () => {
        marker = document.createElement("div")
        marker.setAttribute(PAGE_ENTERING_ATTR, "")
        document.body.appendChild(marker)
    }

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        marker?.remove()
        marker = null
        vi.useRealTimers()
    })

    it("corre al instante si la página no está entrando", () => {
        const cb = vi.fn()
        whenPageEntered(cb)
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("espera a la señal de fin de entrada y corre una sola vez", () => {
        startEntering()
        const cb = vi.fn()
        whenPageEntered(cb)
        expect(cb).not.toHaveBeenCalled()
        window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("no espera más que el tope si la señal nunca llega", () => {
        startEntering()
        const cb = vi.fn()
        whenPageEntered(cb)
        vi.advanceTimersByTime(599)
        expect(cb).not.toHaveBeenCalled()
        vi.advanceTimersByTime(2)
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("corre al instante si el usuario empieza a scrollear", () => {
        startEntering()
        const cb = vi.fn()
        whenPageEntered(cb)
        window.dispatchEvent(new Event("wheel"))
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it("cancelar evita que corra", () => {
        startEntering()
        const cb = vi.fn()
        const cancel = whenPageEntered(cb)
        cancel()
        window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        vi.advanceTimersByTime(1000)
        expect(cb).not.toHaveBeenCalled()
    })
})
