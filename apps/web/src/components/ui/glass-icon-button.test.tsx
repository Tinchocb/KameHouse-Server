import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GlassIconButton } from "./glass-icon-button"

describe("GlassIconButton (IconButton con intent glass)", () => {
    it("es un botón con el título como nombre accesible y dispara onClick", () => {
        const onClick = vi.fn()
        render(<GlassIconButton title="Añadir a la cola" icon={<span>+</span>} onClick={onClick} />)
        fireEvent.click(screen.getByRole("button", { name: "Añadir a la cola" }))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it("usa la receta de vidrio del sistema de botones", () => {
        render(<GlassIconButton title="Añadir a la cola" icon={<span>+</span>} />)
        expect(screen.getByRole("button", { name: "Añadir a la cola" }).className).toContain("backdrop-blur-overlay-sm")
    })
})
