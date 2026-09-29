import { describe, expect, it } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import * as React from "react"
import { OsSelect } from "./components"

const options = [
    { value: "ultrafast", label: "Ultra Rápido" },
    { value: "fast", label: "Rápido" },
    { value: "medium", label: "Medio" },
]

function Harness({ onChange }: { onChange: (v: string) => void }) {
    const [value, setValue] = React.useState("fast")
    return (
        <form>
            <OsSelect
                label="Preset"
                options={options}
                value={value}
                name="preset"
                onChange={(v) => { setValue(v); onChange(v) }}
            />
        </form>
    )
}

// Regresión: dentro de un <form>, Radix usa un <select> nativo oculto cuyas
// <option> salen de SelectPrimitive.ItemText. Sin ItemText el nativo no tenía
// opciones, quedaba en "" y esa "elección" vacía pisaba la real: ningún
// selector de Ajustes cambiaba de valor.
describe("OsSelect", () => {
    it("registra una <option> nativa por opción", () => {
        const { container } = render(<Harness onChange={() => {}} />)
        const native = container.querySelector("select")
        if (!native) throw new Error("falta el <select> nativo")
        const values = [...native.querySelectorAll("option")].map((o) => o.value).filter(Boolean)
        expect(values).toEqual(expect.arrayContaining(options.map((o) => o.value)))
    })

    it("un cambio del <select> nativo no deja el valor vacío", () => {
        const changes: string[] = []
        const { container } = render(<Harness onChange={(v) => changes.push(v)} />)
        const native = container.querySelector("select")
        if (!native) throw new Error("falta el <select> nativo")
        fireEvent.change(native, { target: { value: "medium" } })
        expect(changes.at(-1)).toBe("medium")
        expect(changes).not.toContain("")
    })
})
