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
        render(<TextInput label="Ruta" disabled />)
        const input = screen.getByRole("textbox", { name: "Ruta" }) as HTMLInputElement
        expect(input.disabled).toBe(true)
    })

    it("la variante de línea asocia el error y la ayuda al campo nativo", () => {
        render(<TextInput appearance="line" label="Nombre" help="Nombre de tu lista" error="Escribí un nombre" />)
        const input = screen.getByRole("textbox", { name: "Nombre" })
        expect(input).toHaveAttribute("aria-invalid", "true")
        expect(input).toHaveAccessibleDescription("Nombre de tu lista Escribí un nombre")
        expect(input).not.toHaveAttribute("appearance")
    })
})
