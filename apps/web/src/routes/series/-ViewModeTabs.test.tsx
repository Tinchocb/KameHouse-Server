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
    it("es un radiogroup con las dos vistas y la activa marcada", () => {
        setup("shelf")
        expect(screen.getByRole("radiogroup", { name: "Vista de series" })).toBeInTheDocument()
        expect(screen.getByRole("radio", { name: /Estantería/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("radio", { name: /Portadas/ })).toHaveAttribute("aria-checked", "false")
    })

    it("solo la opción activa entra en el orden de tabulación", () => {
        setup("etapas")
        expect(screen.getByRole("radio", { name: /Portadas/ })).toHaveAttribute("tabindex", "0")
        expect(screen.getByRole("radio", { name: /Estantería/ })).toHaveAttribute("tabindex", "-1")
    })

    it("al elegir otra vista avisa con su identificador", () => {
        const { onChange } = setup("shelf")
        fireEvent.click(screen.getByRole("radio", { name: /Portadas/ }))
        expect(onChange).toHaveBeenCalledWith("etapas")
    })

    it("las flechas mueven la selección", () => {
        const { onChange } = setup("shelf")
        fireEvent.keyDown(screen.getByRole("radio", { name: /Estantería/ }), { key: "ArrowDown" })
        expect(onChange).toHaveBeenLastCalledWith("etapas")
    })
})
