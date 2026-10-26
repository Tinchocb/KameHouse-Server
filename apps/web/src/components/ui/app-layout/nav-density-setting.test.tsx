import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useUIStore } from "@/lib/store"
import { NavDensitySetting } from "./nav-density-setting"

describe("NavDensitySetting", () => {
    beforeEach(() => {
        useUIStore.getState().setNavDensity("auto")
    })

    it("ofrece Automática, Expandida y Compacta, con Automática por defecto", () => {
        render(<NavDensitySetting />)
        expect(screen.getByRole("radiogroup", { name: "Barra de navegación" })).toBeTruthy()
        expect(screen.getByRole("radio", { name: /Automática/ }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("radio", { name: /Expandida/ })).toBeTruthy()
        expect(screen.getByRole("radio", { name: /Compacta/ })).toBeTruthy()
    })

    it("guarda la elección en el store y la describe", () => {
        render(<NavDensitySetting />)
        fireEvent.click(screen.getByRole("radio", { name: /Compacta/ }))
        expect(useUIStore.getState().navDensity).toBe("compact")
        expect(screen.getByText(/Muestra siempre solo los íconos/)).toBeTruthy()
    })

    it("descarta valores inválidos guardados", () => {
        useUIStore.getState().setNavDensity("enorme" as never)
        expect(useUIStore.getState().navDensity).toBe("auto")
    })
})
