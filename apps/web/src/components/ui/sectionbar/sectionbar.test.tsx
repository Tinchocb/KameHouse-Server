import { act, fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it } from "vitest"
import { SectionBar } from "./sectionbar"

describe("SectionBar colapsable", () => {
    it("anuncia la apertura efectiva durante la búsqueda y conserva el estado elegido al terminarla", () => {
        const view = (query: string) => <LazyMotion features={domAnimation}>
            <SectionBar label="Audio" collapsible defaultOpen={false} searchQuery={query}>
                <button>Control de audio</button>
            </SectionBar>
        </LazyMotion>
        const { rerender } = render(view(""))
        const trigger = screen.getByRole("button", { name: "Audio" })
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        const panelId = trigger.getAttribute("aria-controls") ?? ""
        expect(document.getElementById(panelId)).not.toBeNull()
        rerender(view("audio"))
        expect(trigger).toHaveAttribute("aria-expanded", "true")
        rerender(view(""))
        expect(trigger).toHaveAttribute("aria-expanded", "false")
    })

    it("el panel saliente se vuelve inert y devuelve el foco a la cabecera", () => {
        const view = (open: boolean) => <LazyMotion features={domAnimation}>
            <SectionBar label="Audio" collapsible isOpen={open}><button>Control de audio</button></SectionBar>
        </LazyMotion>
        const { rerender } = render(view(true))
        const child = screen.getByRole("button", { name: "Control de audio" })
        act(() => child.focus())
        rerender(view(false))
        expect(child.closest("[inert]")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Audio" })).toHaveFocus()
    })

    it("la cabecera mantiene un título semántico y un botón sin encabezados anidados", () => {
        render(<SectionBar label="Audio" description="Preferencias" collapsible><p>Contenido</p></SectionBar>)
        const heading = screen.getByRole("heading", { level: 2 })
        const trigger = screen.getByRole("button", { name: /Audio/ })
        expect(heading).toContainElement(trigger)
        expect(trigger.querySelector("h2, h3, p, div")).toBeNull()
        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute("aria-expanded", "false")
    })
})
