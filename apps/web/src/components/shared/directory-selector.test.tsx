import { act, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/api/hooks/directory_selector.hooks", () => ({
    useDirectorySelector: () => ({ data: undefined, isLoading: false }),
}))

import { DirectorySelector } from "./directory-selector"

// Padre como PathList: guarda el valor recién cuando llega onSelect (tras el debounce).
function Parent({ onSelect }: { onSelect: (v: string) => void }) {
    const [value, setValue] = React.useState("")
    return (
        <>
            <DirectorySelector
                value={value}
                onSelect={(v) => { setValue(v); onSelect(v) }}
                shouldExist={false}
                label={false}
                aria-label="Carpeta"
            />
            <button type="button" onClick={() => setValue("")}>limpiar</button>
        </>
    )
}

describe("DirectorySelector", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    // Regresión: el efecto de sincronización dependía de `input` y con cada tecla
    // volvía a poner el valor viejo: no se podía escribir una ruta a mano.
    it("conserva lo que se escribe y lo avisa tras el debounce", () => {
        const onSelect = vi.fn()
        render(<Parent onSelect={onSelect} />)
        const input = screen.getByLabelText("Carpeta") as HTMLInputElement

        fireEvent.change(input, { target: { value: "C:/Users/Public" } })
        expect(input.value).toBe("C:/Users/Public")

        act(() => { vi.advanceTimersByTime(400) })
        expect(input.value).toBe("C:/Users/Public")
        expect(onSelect).toHaveBeenLastCalledWith("C:/Users/Public")
    })

    it("se limpia cuando el padre cambia el valor (p. ej. tras Agregar)", () => {
        render(<Parent onSelect={() => {}} />)
        const input = screen.getByLabelText("Carpeta") as HTMLInputElement
        fireEvent.change(input, { target: { value: "C:/Media" } })
        act(() => { vi.advanceTimersByTime(400) })
        fireEvent.click(screen.getByText("limpiar"))
        expect(input.value).toBe("")
    })
})
