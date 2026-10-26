import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { TextInput } from "./text-input"

describe("TextInput readonly", () => {
    it("un campo readonly no queda disabled y recibe foco", () => {
        render(<TextInput label="Ruta" name="ruta" readonly defaultValue="D:/Series" />)
        const input = screen.getByRole("textbox", { name: "Ruta" }) as HTMLInputElement
        expect(input.readOnly).toBe(true)
        expect(input.disabled).toBe(false)
        input.focus()
        expect(document.activeElement).toBe(input)
    })

    it("el readonly no lleva pointer-events-none: el mouse puede seleccionar y copiar", () => {
        render(<TextInput label="Ruta" readonly defaultValue="D:/Series" />)
        const input = screen.getByRole("textbox", { name: "Ruta" })
        expect(input.className).not.toContain("pointer-events-none")
    })

    it("el valor de un readonly se envía con el formulario", () => {
        const { container } = render(
            <form>
                <TextInput label="Ruta" name="ruta" readonly defaultValue="D:/Series" />
            </form>
        )
        const form = container.querySelector("form") as HTMLFormElement
        expect(new FormData(form).get("ruta")).toBe("D:/Series")
    })

    it("un campo disabled sigue deshabilitado", () => {
        // Sin name: BasicField no enlaza la etiqueta cuando el campo está disabled (htmlFor undefined).
        render(<TextInput label="Ruta" disabled />)
        const input = screen.getByRole("textbox") as HTMLInputElement
        expect(input.disabled).toBe(true)
    })
})
