import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { MoviesFilterBar } from "./movies-filter-bar"

function setup() {
    const setSortBy = vi.fn()
    render(
        <LazyMotion features={domAnimation}>
            <MoviesFilterBar
                searchQuery="" setSearchQuery={vi.fn()}
                sortBy="year_asc" setSortBy={setSortBy}
                status="all" setStatus={vi.fn()}
                statusCounts={{ all: 2, pending: 1, continue: 0, watched: 1 }}
                decade={null} setDecade={vi.fn()} decades={[1990, 2000]}
                filteredCount={2} totalCount={2}
                hasActiveFilters={false} onResetFilters={vi.fn()}
            />
        </LazyMotion>,
    )
    return { trigger: screen.getByRole("button", { name: "Ordenar por: Año: más antiguos" }), setSortBy }
}

describe("MoviesFilterBar: menú compartido", () => {
    it("enfoca la selección, navega con flechas y devuelve el foco al elegir", async () => {
        const { trigger, setSortBy } = setup()
        fireEvent.click(trigger)
        const selected = screen.getByRole("button", { name: "Año: más antiguos" })
        await waitFor(() => expect(selected).toHaveFocus())
        fireEvent.keyDown(selected, { key: "Home" })
        const first = screen.getByRole("button", { name: "Alfabético A – Z" })
        expect(first).toHaveFocus()
        fireEvent.keyDown(first, { key: "ArrowDown" })
        const second = screen.getByRole("button", { name: "Alfabético Z – A" })
        expect(second).toHaveFocus()
        fireEvent.click(second)
        expect(setSortBy).toHaveBeenCalledWith("alpha_desc")
        await waitFor(() => expect(trigger).toHaveFocus())
        expect(trigger).toHaveAttribute("aria-expanded", "false")
    })

    it("Escape cierra sin cambiar la selección y restaura el foco", async () => {
        const { trigger, setSortBy } = setup()
        fireEvent.click(trigger)
        const selected = screen.getByRole("button", { name: "Año: más antiguos" })
        await waitFor(() => expect(selected).toHaveFocus())
        fireEvent.keyDown(selected, { key: "Escape" })
        await waitFor(() => expect(trigger).toHaveFocus())
        expect(trigger).toHaveAttribute("aria-expanded", "false")
        expect(setSortBy).not.toHaveBeenCalled()
    })
})
