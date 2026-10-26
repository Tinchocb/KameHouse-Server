import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { OsToggle } from "./components"

// Regresión: el role="switch" de Ajustes tiene que llamarse como su etiqueta. El SpringSwitch
// de dentro va oculto, así que el nombre sale del div que tiene el role, no del interruptor.
describe("OsToggle", () => {
    it("el switch se nombra con la etiqueta y la ayuda va como descripción", () => {
        render(<OsToggle label="Modo oscuro" description="Aplica el tema oscuro" checked={false} onChange={() => {}} />)
        const sw = screen.getByRole("switch", { name: "Modo oscuro" })
        const describedBy = sw.getAttribute("aria-describedby")
        expect(describedBy).toBeTruthy()
        expect(document.getElementById(describedBy as string)?.textContent).toBe("Aplica el tema oscuro")
    })

    it("la pastilla 'Requiere guardar' no entra en el nombre", () => {
        render(<OsToggle label="Modo oscuro" checked onChange={() => {}} dirty />)
        expect(screen.getByRole("switch", { name: "Modo oscuro" })).toBeTruthy()
    })

    it("sin descripción no declara aria-describedby", () => {
        render(<OsToggle label="Modo oscuro" checked onChange={() => {}} />)
        expect(screen.getByRole("switch", { name: "Modo oscuro" }).getAttribute("aria-describedby")).toBeNull()
    })
})
