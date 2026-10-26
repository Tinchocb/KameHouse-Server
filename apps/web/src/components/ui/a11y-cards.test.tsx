import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MoviePosterCard } from "./movie-poster-card"
import { SectionBar } from "./sectionbar/sectionbar"
import { Modal } from "./modal/modal"

// Los controles interactivos no se anidan: un role="button" con botones dentro
// (play, cola) confunde a lectores de pantalla y a axe (nested-interactive).
describe("MoviePosterCard", () => {
    const setup = (onClick = vi.fn(), onOverlay = vi.fn()) => {
        const view = render(
            <MoviePosterCard
                image=""
                title="La Leyenda de Shenlong"
                initial={false}
                onClick={onClick}
                centerOverlay={
                    <button type="button" aria-label="Añadir a la cola" onClick={(e) => { e.stopPropagation(); onOverlay() }}>
                        +
                    </button>
                }
            />,
        )
        return { ...view, onClick, onOverlay }
    }

    it("el destino de teclado es un botón real y no hay controles anidados", () => {
        const { container } = setup()
        expect(screen.getByRole("button", { name: "La Leyenda de Shenlong" })).toBeTruthy()
        expect(container.querySelectorAll("[role=button]").length).toBe(0)
        expect(container.querySelectorAll("button button").length).toBe(0)
    })

    it("activar el botón principal dispara onClick una sola vez", () => {
        const { onClick } = setup()
        fireEvent.click(screen.getByRole("button", { name: "La Leyenda de Shenlong" }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("la acción secundaria no dispara la principal", () => {
        const { onClick, onOverlay } = setup()
        fireEvent.click(screen.getByRole("button", { name: "Añadir a la cola" }))
        expect(onOverlay).toHaveBeenCalledTimes(1)
        expect(onClick).not.toHaveBeenCalled()
    })

    it("sin onClick no hay botón principal", () => {
        render(<MoviePosterCard image="" title="Solo lectura" initial={false} />)
        expect(screen.queryByRole("button")).toBeNull()
    })
})

// El título bajo el póster va sobre el fondo de página: su color sale del tema, no de blanco fijo.
describe("MoviePosterCard · título", () => {
    it("usa text-on-surface y no text-white", () => {
        render(<MoviePosterCard image="" title="Dragon Ball Z: La Batalla" initial={false} />)
        const title = screen.getByText("Dragon Ball Z: La Batalla")
        expect(title.className).toContain("text-on-surface")
        expect(title.className).not.toContain("text-white")
    })
})

describe("SectionBar", () => {
    it("el título es h2 por defecto y admite h3", () => {
        const { rerender } = render(<SectionBar label="Apariencia">x</SectionBar>)
        expect(screen.getByRole("heading", { level: 2, name: "Apariencia" })).toBeTruthy()
        rerender(<SectionBar label="Apariencia" headingLevel="h3">x</SectionBar>)
        expect(screen.getByRole("heading", { level: 3, name: "Apariencia" })).toBeTruthy()
    })
})

describe("Modal", () => {
    it("sin title visible el diálogo igual tiene nombre accesible", () => {
        render(<Modal open srTitle="Buscar en KameHouse"><p>contenido</p></Modal>)
        expect(screen.getByRole("dialog", { name: "Buscar en KameHouse" })).toBeTruthy()
    })

    it("sin title ni srTitle usa un nombre por defecto", () => {
        render(<Modal open><p>contenido</p></Modal>)
        expect(screen.getByRole("dialog", { name: "Ventana" })).toBeTruthy()
    })
})
