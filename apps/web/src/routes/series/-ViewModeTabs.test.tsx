import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { ViewModeTabs } from "./-ViewModeTabs"

function setup(mode: "shelf" | "etapas" = "shelf") {
    const onChange = vi.fn()
    render(
        <LazyMotion features={domAnimation}>
            <ViewModeTabs mode={mode} onChange={onChange} />
        </LazyMotion>,
    )
    return { onChange }
}

describe("ViewModeTabs", () => {
    it("es un tablist con las dos vistas y la activa seleccionada", () => {
        setup("shelf")
        expect(screen.getByRole("tablist", { name: "Modo de visualización de series" })).toBeInTheDocument()
        expect(screen.getByRole("tab", { name: /Estantería/ })).toHaveAttribute("aria-selected", "true")
        expect(screen.getByRole("tab", { name: /Portadas/ })).toHaveAttribute("aria-selected", "false")
    })

    it("solo la pestaña activa entra en el orden de tabulación", () => {
        setup("etapas")
        expect(screen.getByRole("tab", { name: /Portadas/ })).toHaveAttribute("tabindex", "0")
        expect(screen.getByRole("tab", { name: /Estantería/ })).toHaveAttribute("tabindex", "-1")
    })

    it("al elegir otra vista avisa con su identificador", () => {
        const { onChange } = setup("shelf")
        fireEvent.click(screen.getByRole("tab", { name: /Portadas/ }))
        expect(onChange).toHaveBeenCalledWith("etapas")
    })

    it("las flechas, Inicio y Fin mueven la selección", () => {
        const { onChange } = setup("shelf")
        const shelf = screen.getByRole("tab", { name: /Estantería/ })
        fireEvent.keyDown(shelf, { key: "ArrowRight" })
        expect(onChange).toHaveBeenLastCalledWith("etapas")
        fireEvent.keyDown(shelf, { key: "End" })
        expect(onChange).toHaveBeenLastCalledWith("etapas")
        fireEvent.keyDown(screen.getByRole("tab", { name: /Portadas/ }), { key: "Home" })
        expect(onChange).toHaveBeenLastCalledWith("shelf")
    })

    it("cada pestaña mide al menos 44 px de alto (touch target)", () => {
        setup()
        for (const tab of screen.getAllByRole("tab")) {
            expect(tab.className).toMatch(/min-h-11/)
        }
    })
})
