import { afterEach, describe, expect, it, vi } from "vitest"
import { crossfadeThemeChange, startViewTransition } from "./transitions"

const originalTransition = Object.getOwnPropertyDescriptor(document, "startViewTransition")
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.eraFade
    if (originalTransition) Object.defineProperty(document, "startViewTransition", originalTransition)
    else Reflect.deleteProperty(document, "startViewTransition")
})

describe("transiciones manuales y movimiento reducido", () => {
    function nativeTransition() {
        let notify = () => {}
        let complete!: () => void
        let fail!: (reason: Error) => void
        let update!: () => void
        const finished = new Promise<void>((resolve, reject) => { complete = resolve; fail = reject })
        const media = {
            matches: false,
            addEventListener: vi.fn((_event: string, callback: () => void) => { notify = callback }),
            removeEventListener: vi.fn(),
        }
        const skipTransition = vi.fn()
        Object.defineProperty(document, "startViewTransition", {
            configurable: true,
            value: (callback: () => void) => {
                update = callback
                return { finished, ready: Promise.resolve(), skipTransition }
            },
        })
        vi.stubGlobal("matchMedia", () => media)
        return { media, skipTransition, complete, fail, notify: () => notify(), update: () => update() }
    }

    it("salta una transición activa sin perder su actualización, y retira el listener", async () => {
        const native = nativeTransition()
        const update = vi.fn()
        startViewTransition(update)
        expect(update).not.toHaveBeenCalled()
        native.media.matches = true
        native.notify()
        native.notify()
        expect(native.skipTransition).toHaveBeenCalledTimes(1)
        native.update()
        expect(update).toHaveBeenCalledTimes(1)
        native.complete()
        await Promise.resolve()
        expect(native.media.removeEventListener).toHaveBeenCalledTimes(1)
        expect(native.media.removeEventListener.mock.calls[0]).toEqual(native.media.addEventListener.mock.calls[0])
    })

    it.each(["finish", "abort"] as const)("limpia recursos al terminar con %s", async outcome => {
        const native = nativeTransition()
        const update = vi.fn()
        startViewTransition(update)
        native.update()
        if (outcome === "finish") native.complete()
        else native.fail(new Error("Interrupted"))
        await Promise.resolve()
        expect(update).toHaveBeenCalledTimes(1)
        expect(native.media.removeEventListener).toHaveBeenCalledTimes(1)
        expect(native.skipTransition).not.toHaveBeenCalled()
    })

    it("no registra un listener si la creación nativa falla", () => {
        const media = { matches: false, addEventListener: vi.fn() }
        vi.stubGlobal("matchMedia", () => media)
        Object.defineProperty(document, "startViewTransition", { configurable: true, value: () => { throw new Error("Unavailable") } })
        expect(() => startViewTransition(() => {})).toThrow("Unavailable")
        expect(media.addEventListener).not.toHaveBeenCalled()
    })
    it("aplica cambios directamente sin capturas ni fundido de paleta", () => {
        vi.stubGlobal("matchMedia", () => ({ matches: true }))
        const update = vi.fn()
        startViewTransition(update)
        crossfadeThemeChange(update)
        expect(update).toHaveBeenCalledTimes(2)
        expect(document.documentElement).not.toHaveAttribute("data-era-fade")
    })

    it("interrumpe el fundido y elimina listeners si la preferencia cambia", () => {
        vi.useFakeTimers()
        let notify = () => {}
        const media = {
            matches: false,
            addEventListener: vi.fn((_event: string, callback: () => void) => { notify = callback }),
            removeEventListener: vi.fn(),
        }
        vi.stubGlobal("matchMedia", () => media)
        crossfadeThemeChange(() => {})
        expect(document.documentElement).toHaveAttribute("data-era-fade", "true")
        media.matches = true
        notify()
        expect(document.documentElement).not.toHaveAttribute("data-era-fade")
        expect(media.removeEventListener).toHaveBeenCalledTimes(1)
        expect(vi.getTimerCount()).toBe(0)
    })

    it("retira la marca después del fundido breve y libera su listener", () => {
        vi.useFakeTimers()
        const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
        vi.stubGlobal("matchMedia", () => media)
        crossfadeThemeChange(() => {})
        vi.advanceTimersByTime(199)
        expect(document.documentElement).toHaveAttribute("data-era-fade")
        vi.advanceTimersByTime(1)
        expect(document.documentElement).not.toHaveAttribute("data-era-fade")
        expect(media.removeEventListener).toHaveBeenCalledTimes(1)
    })
})
