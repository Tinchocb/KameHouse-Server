import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SettingsLoadError } from "./settings-load-error"

describe("error de carga de Ajustes (QA-01)", () => {
    it("avisa de que no se cargaron los ajustes y ofrece reintentar", () => {
        const onRetry = vi.fn()
        render(<SettingsLoadError onRetry={onRetry} />)
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los ajustes")
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
