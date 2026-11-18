import { act, render, screen, waitFor } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { PlayerPanelReveal } from "./player-panel-reveal"

function mockPointer(coarse: boolean) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: q.includes("coarse") ? coarse : false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
}

describe("PlayerPanelReveal táctil", () => {
    it("neutraliza el desplazamiento si cambia la preferencia durante una salida y termina de desmontar", async () => {
        let notify = () => {}
        const media = { matches: false, addEventListener: vi.fn((_type: string, listener: () => void) => { notify = listener }), removeEventListener: vi.fn() }
        vi.stubGlobal("matchMedia", (query: string) => query.includes("prefers-reduced-motion") ? media : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
        const view = (isOpen: boolean) => <LazyMotion features={domAnimation}><PlayerPanelReveal isOpen={isOpen} onClose={() => {}} title="Cola"><button>Continuar</button></PlayerPanelReveal></LazyMotion>
        const { rerender, unmount } = render(view(true))
        const dialog = screen.getByRole("dialog", { name: "Cola" })
        await waitFor(() => expect(dialog.style.transform).toBe("none"))
        rerender(view(false))
        act(() => { media.matches = true; notify() })
        await waitFor(() => expect(dialog.style.transform).toBe("none"))
        expect(dialog).toHaveAttribute("inert")
        await waitFor(() => expect(dialog.isConnected).toBe(false))
        unmount()
        expect(media.removeEventListener).toHaveBeenCalledTimes(1)
        vi.unstubAllGlobals()
    })
    it("recupera la interacción al reabrir durante la salida", async () => {
        mockPointer(false)
        const view = (isOpen: boolean) => (
            <LazyMotion features={domAnimation}>
                <PlayerPanelReveal isOpen={isOpen} onClose={() => {}} title="Cola">
                    <button>Continuar</button>
                </PlayerPanelReveal>
            </LazyMotion>
        )
        const { rerender } = render(view(true))
        const dialog = screen.getByRole("dialog", { name: "Cola" })
        await waitFor(() => expect(dialog.style.transform).toBe("none"))
        rerender(view(false))
        expect(dialog).toHaveAttribute("inert")
        await waitFor(() => expect(dialog.style.pointerEvents).toBe("none"))
        rerender(view(true))
        expect(screen.getByRole("dialog", { name: "Cola" })).toBe(dialog)
        expect(dialog).not.toHaveAttribute("inert")
        await waitFor(() => expect(dialog.style.pointerEvents).toBe("auto"))
    })

    it.each([true, false])("renderiza el diálogo con puntero coarse=%s", (coarse) => {
        mockPointer(coarse)
        render(<PlayerPanelReveal isOpen onClose={() => {}} title="Cola"><p>x</p></PlayerPanelReveal>)
        const dialog = screen.getByRole("dialog", { name: "Cola" })
        expect(dialog).toBeTruthy()
        // Con drag horizontal framer fija touch-action: pan-y para no romper el scroll de la lista.
        expect(dialog.style.touchAction === "pan-y").toBe(coarse)
    })
})
