import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { CSSProperties, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerformanceMonitor } from "./performance-monitor"

vi.mock("./use-route-latency", () => ({ useRouteLatency: () => null }))
vi.mock("framer-motion", () => ({
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    m: { div: ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => <div className={className} style={style}>{children}</div> },
}))

let visible = true
let focused = true
let clock = 0
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()
function frameAt(time: number) {
    act(() => {
        clock = time
        const callbacks = [...frames.values()]
        frames.clear()
        callbacks.forEach(callback => callback(time))
    })
}
beforeEach(() => {
    visible = true
    focused = true
    clock = 0
    frames.clear()
    localStorage.setItem("kamehouse:perf-monitor-enabled", "true")
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visible ? "visible" : "hidden" })
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused)
    vi.spyOn(performance, "now").mockImplementation(() => clock)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
})
afterEach(() => {
    cleanup()
    localStorage.removeItem("kamehouse:perf-monitor-enabled")
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (document as unknown as { visibilityState?: string }).visibilityState
})

describe("diagnostic panel frame lifecycle", () => {
    it("starts no frames when opened in the background and resumes once visible", () => {
        visible = false
        const view = render(<PerformanceMonitor />)
        expect(frames.size).toBe(0)
        act(() => window.dispatchEvent(new Event("focus")))
        expect(frames.size).toBe(0)
        act(() => { visible = true; document.dispatchEvent(new Event("visibilitychange")) })
        expect(frames.size).toBe(1)
        act(() => window.dispatchEvent(new Event("focus")))
        expect(frames.size).toBe(1)
        view.unmount()
        expect(frames.size).toBe(0)
    })
    it("suspends on blur and hidden state, and does not restart after closing", () => {
        render(<PerformanceMonitor />)
        expect(frames.size).toBe(1)
        act(() => { focused = false; window.dispatchEvent(new Event("blur")) })
        expect(frames.size).toBe(0)
        act(() => { focused = true; window.dispatchEvent(new Event("focus")) })
        expect(frames.size).toBe(1)
        act(() => { visible = false; document.dispatchEvent(new Event("visibilitychange")) })
        expect(frames.size).toBe(0)
        fireEvent.click(screen.getByRole("button", { name: "Cerrar diagnóstico de rendimiento" }))
        act(() => { visible = true; document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")) })
        expect(frames.size).toBe(0)
    })
    it("does not count time in the background as a slow frame", () => {
        render(<PerformanceMonitor />)
        for (let i = 0; i < 32; i++) frameAt(i * 16)
        expect(screen.getByText("Máximo: 16 ms")).toBeTruthy()
        act(() => { focused = false; window.dispatchEvent(new Event("blur")); clock = 10000 })
        act(() => { focused = true; window.dispatchEvent(new Event("focus")) })
        for (let i = 0; i < 32; i++) frameAt(10000 + i * 16)
        expect(screen.getByText("Máximo: 16 ms")).toBeTruthy()
        expect(screen.getByText("Cuadros lentos").nextElementSibling?.textContent).toBe("0")
    })
    it("a late frame cannot resurrect the loop after unmount", () => {
        const view = render(<PerformanceMonitor />)
        const lateFrame = [...frames.values()][0]
        view.unmount()
        lateFrame(500)
        expect(frames.size).toBe(0)
    })
    it("a stale frame from a closed panel cannot disturb its reopened loop", () => {
        render(<PerformanceMonitor />)
        const staleFrame = [...frames.values()][0]
        fireEvent.click(screen.getByRole("button", { name: "Cerrar diagnóstico de rendimiento" }))
        act(() => window.dispatchEvent(new Event("kamehouse:toggle-perf-monitor")))
        expect(frames.size).toBe(1)
        staleFrame(500)
        act(() => window.dispatchEvent(new Event("focus")))
        expect(frames.size).toBe(1)
    })
})
