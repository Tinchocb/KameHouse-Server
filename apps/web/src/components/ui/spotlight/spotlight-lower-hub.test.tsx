import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { ERA_COLOR_MAP } from "@/lib/config/eras"
import { SpotlightLowerHub } from "./spotlight-lower-hub"

vi.mock("./spotlight-saga-card", () => ({ SpotlightSagaCard: () => <div>Saga disponible</div> }))
vi.mock("./spotlight-movie-card", () => ({ SpotlightMovieCard: () => <div>Película disponible</div> }))

const props = {
    activeEraId: "db" as const,
    colors: ERA_COLOR_MAP.db,
    activeEraSagas: [{ id: "saga", title: "Saga", description: "", startEp: 1, endEp: 2 }],
    activeEraMovies: [{ id: "movie", title: "Película", image: "", onClick: vi.fn() }],
    activeSeries: null,
    activeEraSeriesId: 1,
    serverBase: "",
    onNavigateSaga: vi.fn(),
    onNavigateMovie: vi.fn(),
    onHoverSound: vi.fn(),
}

describe("SpotlightLowerHub: pestañas y contenido", () => {
    it("mantiene el panel asociado al cambiar de pestaña con teclado", async () => {
        render(<LazyMotion features={domAnimation}><SpotlightLowerHub {...props} /></LazyMotion>)
        const sagas = screen.getByRole("tab", { name: /Sagas y arcos/ })
        const movies = screen.getByRole("tab", { name: /Películas/ })
        const panel = screen.getByRole("tabpanel", { name: /Sagas y arcos/ })
        expect(sagas).toHaveAttribute("aria-controls", panel.id)
        expect(movies).toHaveAttribute("aria-controls", panel.id)
        sagas.focus()
        fireEvent.keyDown(sagas, { key: "ArrowRight" })
        expect(movies).toHaveFocus()
        expect(movies).toHaveAttribute("aria-selected", "true")
        expect(screen.getByRole("tabpanel", { name: /Películas/ })).toBe(panel)
        expect(panel).toHaveAttribute("aria-labelledby", movies.id)
        await waitFor(() => expect(screen.queryByText("Saga disponible")).not.toBeInTheDocument())
        fireEvent.keyDown(movies, { key: "Home" })
        expect(sagas).toHaveFocus()
        expect(screen.getByRole("tabpanel", { name: /Sagas y arcos/ })).toBe(panel)
        await waitFor(() => expect(screen.queryByText("Película disponible")).not.toBeInTheDocument())
    })

    it("no anuncia un panel de pestañas cuando solo hay sagas", () => {
        render(<LazyMotion features={domAnimation}><SpotlightLowerHub {...props} activeEraMovies={[]} /></LazyMotion>)
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
        expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument()
    })
})
