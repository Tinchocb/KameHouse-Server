import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { HoldConfirm } from "./hold-confirm"

describe("HoldConfirm", () => {
    afterEach(() => vi.restoreAllMocks())

    function controlFrames() {
        const frames = new Map<number, FrameRequestCallback>()
        let id = 0
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(cb => { frames.set(++id, cb); return id })
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(key => { frames.delete(key) })
        vi.spyOn(performance, "now").mockReturnValue(0)
        return async (time: number) => {
            await act(async () => {
                const batch = [...frames.values()]
                frames.clear()
                batch.forEach(cb => cb(time))
            })
        }
    }

    it("cancela al perder el foco, aunque no reciba keyup", async () => {
        const frame = controlFrames()
        const onConfirm = vi.fn()
        render(<HoldConfirm onConfirm={onConfirm} />)
        const button = screen.getByRole("button")
        fireEvent.keyDown(button, { key: " " })
        fireEvent.blur(button)
        await frame(900)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it("cancela si se deshabilita durante la pulsación", async () => {
        const frame = controlFrames()
        const onConfirm = vi.fn()
        const view = render(<HoldConfirm onConfirm={onConfirm} />)
        fireEvent.pointerDown(screen.getByRole("button"), { button: 0 })
        view.rerender(<HoldConfirm onConfirm={onConfirm} disabled />)
        await frame(900)
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it("espera el resultado y no repite la acción mientras está pendiente", async () => {
        const frame = controlFrames()
        let resolve!: () => void
        const onConfirm = vi.fn(() => new Promise<void>(done => { resolve = done }))
        render(<HoldConfirm onConfirm={onConfirm} confirmLabel="Restablecido" />)
        const button = screen.getByRole("button")
        fireEvent.keyDown(button, { key: "Enter" })
        await frame(900)
        expect(button).toHaveAttribute("aria-busy", "true")
        expect(screen.queryByText("Restablecido")).toBeNull()
        fireEvent.keyDown(button, { key: "Enter" })
        await frame(1800)
        expect(onConfirm).toHaveBeenCalledTimes(1)
        await act(async () => resolve())
        expect(screen.getByText("Restablecido")).toBeInTheDocument()
    })

    it("un rechazo muestra error y permite volver a intentarlo", async () => {
        const frame = controlFrames()
        const onConfirm = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined)
        render(<HoldConfirm onConfirm={onConfirm} confirmLabel="Restablecido" />)
        const button = screen.getByRole("button")
        fireEvent.keyDown(button, { key: "Enter" })
        await frame(900)
        expect(screen.queryByText("Restablecido")).toBeNull()
        expect(screen.getByRole("status")).toHaveTextContent("No se pudo completar")
        expect(button).not.toBeDisabled()
        fireEvent.keyDown(button, { key: "Enter" })
        await frame(900)
        expect(onConfirm).toHaveBeenCalledTimes(2)
        expect(screen.getByText("Restablecido")).toBeInTheDocument()
    })
    it("dice en tuteo qué hacer y no fuerza mayúsculas ni tracking", () => {
        render(<HoldConfirm onConfirm={() => {}} />)
        const button = screen.getByRole("button", { name: /Mantén para confirmar/ })
        expect(button.className).not.toMatch(/uppercase|tracking-/)
    })

    it("usa tokens (sin blanco fijo) y el rojo legible en la variante destructiva", () => {
        const { rerender } = render(<HoldConfirm onConfirm={() => {}} variant="default" />)
        expect(screen.getByRole("button").className).not.toMatch(/\btext-white\b|\bbg-white\/|border-white\//)
        rerender(<HoldConfirm onConfirm={() => {}} variant="destructive" />)
        expect(screen.getByRole("button").className).toMatch(/text-status-error-fg/)
    })

    it("solo confirma al completar la pulsación larga", () => {
        const onConfirm = vi.fn()
        render(<HoldConfirm onConfirm={onConfirm} holdDurationMs={800} />)
        const button = screen.getByRole("button")
        fireEvent.pointerDown(button, { button: 0 })
        fireEvent.pointerUp(button, { button: 0 })
        expect(onConfirm).not.toHaveBeenCalled()
    })

    it("cancelar la pulsación (pointercancel) no confirma", () => {
        const onConfirm = vi.fn()
        render(<HoldConfirm onConfirm={onConfirm} holdDurationMs={800} />)
        const button = screen.getByRole("button")
        fireEvent.pointerDown(button, { button: 0 })
        fireEvent.pointerCancel(button)
        expect(onConfirm).not.toHaveBeenCalled()
    })
})
