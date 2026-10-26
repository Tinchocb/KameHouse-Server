import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnimatedTooltip } from "./animated-tooltip"

describe("AnimatedTooltip · puntero y táctil (A-10)", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("hover y foco no dejan un temporizador huérfano al abandonar el control", () => {
        render(<AnimatedTooltip content="Ayuda"><button>Control</button></AnimatedTooltip>)
        const button = screen.getByRole("button")
        const wrapper = button.parentElement as HTMLElement
        fireEvent.pointerEnter(wrapper, { pointerType: "mouse" })
        act(() => { vi.advanceTimersByTime(30); button.focus() })
        fireEvent.pointerLeave(wrapper, { pointerType: "mouse" })
        act(() => button.blur())
        act(() => vi.advanceTimersByTime(300))
        expect(screen.queryByRole("tooltip")).toBeNull()
    })

    it("mantiene la ayuda mientras el botón conserva foco y Escape la cierra", () => {
        render(<AnimatedTooltip content="Ayuda"><button aria-describedby="existing">Control</button></AnimatedTooltip>)
        const button = screen.getByRole("button")
        act(() => button.focus())
        act(() => vi.advanceTimersByTime(200))
        const tooltip = screen.getByRole("tooltip")
        expect(button.getAttribute("aria-describedby")).toBe(`existing ${tooltip.id}`)
        fireEvent.pointerLeave(button.parentElement as HTMLElement, { pointerType: "mouse" })
        expect(screen.getByRole("tooltip")).toBeInTheDocument()
        fireEvent.keyDown(button, { key: "Escape" })
        expect(screen.queryByRole("tooltip")).toBeNull()
        expect(button).toHaveAttribute("aria-describedby", "existing")
    })

    it("recupera la ayuda por teclado después de una interacción touch", () => {
        render(<AnimatedTooltip content="Ayuda"><button>Control</button></AnimatedTooltip>)
        const button = screen.getByRole("button")
        fireEvent.pointerDown(button, { pointerType: "touch" })
        act(() => { button.focus(); button.blur() })
        fireEvent.keyDown(document.body, { key: "Tab" })
        act(() => button.focus())
        act(() => vi.advanceTimersByTime(200))
        expect(screen.getByRole("tooltip")).toHaveTextContent("Ayuda")
    })

    it("el ratón abre el tooltip tras el retardo", () => {
        render(
            <AnimatedTooltip content="Reproducir">
                <button type="button">Play</button>
            </AnimatedTooltip>,
        )
        const wrapper = screen.getByRole("button").parentElement as HTMLElement
        fireEvent.pointerEnter(wrapper, { pointerType: "mouse" })
        act(() => {
            vi.advanceTimersByTime(200)
        })
        expect(screen.queryByText("Reproducir")).not.toBeNull()
    })

    it("un toque no abre el tooltip, ni por el puntero ni por el foco que deja el toque", () => {
        render(
            <AnimatedTooltip content="Reproducir">
                <button type="button">Play</button>
            </AnimatedTooltip>,
        )
        const btn = screen.getByRole("button")
        const wrapper = btn.parentElement as HTMLElement
        fireEvent.pointerDown(btn, { pointerType: "touch" })
        fireEvent.pointerEnter(wrapper, { pointerType: "touch" })
        act(() => {
            btn.focus()
        })
        act(() => {
            vi.advanceTimersByTime(300)
        })
        expect(screen.queryByText("Reproducir")).toBeNull()
    })

    it("el foco por teclado sí lo abre", () => {
        render(
            <AnimatedTooltip content="Reproducir">
                <button type="button">Play</button>
            </AnimatedTooltip>,
        )
        const btn = screen.getByRole("button")
        act(() => {
            btn.focus()
        })
        act(() => {
            vi.advanceTimersByTime(200)
        })
        expect(screen.queryByText("Reproducir")).not.toBeNull()
    })
})
