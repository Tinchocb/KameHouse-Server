import { render, screen } from "@testing-library/react"
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
    it.each([true, false])("renderiza el diálogo con puntero coarse=%s", (coarse) => {
        mockPointer(coarse)
        render(<PlayerPanelReveal isOpen onClose={() => {}} title="Cola"><p>x</p></PlayerPanelReveal>)
        const dialog = screen.getByRole("dialog", { name: "Cola" })
        expect(dialog).toBeTruthy()
        // Con drag horizontal framer fija touch-action: pan-y para no romper el scroll de la lista.
        expect(dialog.style.touchAction === "pan-y").toBe(coarse)
    })
})
