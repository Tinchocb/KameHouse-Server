import { renderHook, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePerformanceStore } from "./performance-store"
import {
    GOVERNOR_SUSTAIN_MS,
    governorThresholds,
    startPerformanceGovernor,
    stepGovernor,
    usePerformanceGovernor,
    type GovernorStreaks,
} from "./performance-governor"

// Cuadros del navegador simulados: cada rAF queda pendiente hasta que el test lo ejecuta.
let pending: FrameRequestCallback | null = null
let focused = true

/** Ejecuta el próximo cuadro con la marca de tiempo dada. */
function frameAt(t: number) {
    const cb = pending
    pending = null
    cb?.(t)
}

/** Corre cuadros cada `stepMs` desde `from` hasta `to`, con la marca de tiempo del navegador. */
function runFrames(from: number, to: number, stepMs: number) {
    for (let t = from; t <= to; t += stepMs) frameAt(t)
}

const throttled = () => usePerformanceStore.getState().autoThrottleActive

beforeEach(() => {
    pending = null
    focused = true
    usePerformanceStore.setState({ autoGovernorEnabled: true, autoThrottleActive: false, hardwareSpecs: null })
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        pending = cb
        return 1
    })
    vi.stubGlobal("cancelAnimationFrame", () => {
        pending = null
    })
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused)
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (document as unknown as { visibilityState?: string }).visibilityState
})

describe("governorThresholds", () => {
    it("a 60 Hz tolera caer hasta 30 FPS y se recupera desde 40", () => {
        expect(governorThresholds(60)).toEqual({ minHealthyFps: 30, recoveryFps: 40 })
    })

    it("a 120 Hz o más los umbrales son más altos", () => {
        expect(governorThresholds(120)).toEqual({ minHealthyFps: 45, recoveryFps: 70 })
    })
})

describe("stepGovernor", () => {
    const start: GovernorStreaks = { lowSince: null, healthySince: null }

    it("no activa el ahorro antes de 5 s seguidos bajo el umbral", () => {
        let s = stepGovernor(start, { now: 0, fps: 20, throttled: false, targetHz: 60 })
        expect(s.action).toBeNull()
        s = stepGovernor(s.streaks, { now: 4000, fps: 20, throttled: false, targetHz: 60 })
        expect(s.action).toBeNull()
        s = stepGovernor(s.streaks, { now: 5000, fps: 20, throttled: false, targetHz: 60 })
        expect(s.action).toBe("throttle")
    })

    it("un cuadro sano corta la racha de FPS bajo", () => {
        let s = stepGovernor(start, { now: 0, fps: 20, throttled: false, targetHz: 60 })
        s = stepGovernor(s.streaks, { now: 3000, fps: 35, throttled: false, targetHz: 60 })
        expect(s.streaks.lowSince).toBeNull()
        s = stepGovernor(s.streaks, { now: 4000, fps: 20, throttled: false, targetHz: 60 })
        s = stepGovernor(s.streaks, { now: 8000, fps: 20, throttled: false, targetHz: 60 })
        expect(s.action).toBeNull()
        s = stepGovernor(s.streaks, { now: 9000, fps: 20, throttled: false, targetHz: 60 })
        expect(s.action).toBe("throttle")
    })

    it("suelta el ahorro tras 5 s con FPS igual o mayor que la recuperación", () => {
        let s = stepGovernor(start, { now: 0, fps: 50, throttled: true, targetHz: 60 })
        s = stepGovernor(s.streaks, { now: GOVERNOR_SUSTAIN_MS - 1, fps: 50, throttled: true, targetHz: 60 })
        expect(s.action).toBeNull()
        s = stepGovernor(s.streaks, { now: GOVERNOR_SUSTAIN_MS, fps: 50, throttled: true, targetHz: 60 })
        expect(s.action).toBe("release")
    })

    it("con el ahorro activo, un FPS entre el mínimo y la recuperación no lo suelta", () => {
        let s = stepGovernor(start, { now: 0, fps: 35, throttled: true, targetHz: 60 })
        for (let t = 1000; t <= 20000; t += 1000) {
            s = stepGovernor(s.streaks, { now: t, fps: 35, throttled: true, targetHz: 60 })
            expect(s.action).toBeNull()
        }
    })

    it("a 120 Hz, 40 FPS ya cuentan como bajos", () => {
        let s = stepGovernor(start, { now: 0, fps: 40, throttled: false, targetHz: 120 })
        s = stepGovernor(s.streaks, { now: GOVERNOR_SUSTAIN_MS, fps: 40, throttled: false, targetHz: 120 })
        expect(s.action).toBe("throttle")
    })

    it("a 60 Hz, 40 FPS son sanos", () => {
        const s = stepGovernor(start, { now: 0, fps: 40, throttled: false, targetHz: 60 })
        expect(s.streaks).toEqual({ lowSince: null, healthySince: null })
        expect(s.action).toBeNull()
    })
})

describe("startPerformanceGovernor", () => {
    it("también detecta degradación extrema de 2 FPS", () => {
        const t0 = performance.now()
        const stop = startPerformanceGovernor()
        runFrames(t0 + 500, t0 + 12000, 500)
        expect(throttled()).toBe(true)
        stop()
    })

    it("activa el ahorro tras FPS bajos sostenidos y lo suelta al recuperarse", () => {
        const t0 = performance.now()
        const stop = startPerformanceGovernor()

        // 20 FPS: bajo el mínimo de 60 Hz. Tras el warm-up de 2 s, 5 s seguidos activan el ahorro.
        runFrames(t0 + 50, t0 + 6500, 50)
        expect(throttled()).toBe(false)
        runFrames(t0 + 6550, t0 + 9000, 50)
        expect(throttled()).toBe(true)

        // 60 FPS: la ventana de 1 s tarda en llenarse de sanos y luego 5 s seguidos los sueltan.
        runFrames(t0 + 9016, t0 + 12000, 16)
        expect(throttled()).toBe(true)
        runFrames(t0 + 12016, t0 + 16000, 16)
        expect(throttled()).toBe(false)

        stop()
    })

    it("no cuenta cuadros mientras la ventana no tiene foco", () => {
        focused = false
        expect(document.hasFocus()).toBe(false)
        const t0 = performance.now()
        const stop = startPerformanceGovernor()

        runFrames(t0 + 50, t0 + 10000, 50)
        expect(throttled()).toBe(false)

        stop()
    })

    it("al detenerse cancela el próximo cuadro", () => {
        const stop = startPerformanceGovernor()
        expect(pending).not.toBeNull()
        stop()
        expect(pending).toBeNull()
    })
})

describe("usePerformanceGovernor", () => {
    it("no corre mientras la interfaz no está lista", () => {
        renderHook(() => usePerformanceGovernor(false))
        expect(pending).toBeNull()
    })

    it("no corre si el usuario desactivó el gobernador", () => {
        usePerformanceStore.setState({ autoGovernorEnabled: false })
        renderHook(() => usePerformanceGovernor(true))
        expect(pending).toBeNull()
    })

    it("corre cuando la interfaz está lista y la preferencia lo permite", () => {
        renderHook(() => usePerformanceGovernor(true))
        expect(pending).not.toBeNull()
    })
})
