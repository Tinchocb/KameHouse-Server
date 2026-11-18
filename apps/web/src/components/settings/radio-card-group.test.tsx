import { fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { RadioCardGroup } from "./radio-card-group"

function Example({ initial = "a" }: { initial?: string }) {
    const [value, setValue] = useState(initial)
    return <LazyMotion features={domAnimation}>
        <RadioCardGroup name="playback" label="Reproducción" value={value} onChange={setValue}
            options={[{ value: "a", label: "Automático" }, { value: "b", label: "Original" }, { value: "c", label: "Convertido" }]} />
    </LazyMotion>
}

describe("RadioCardGroup · navegación de teclado", () => {
    it("entra por la opción seleccionada y mueve selección y foco con flechas", () => {
        render(<Example initial="b" />)
        const radios = screen.getAllByRole("radio")
        expect(radios.map(radio => radio.tabIndex)).toEqual([-1, 0, -1])
        radios[1].focus()
        fireEvent.keyDown(radios[1], { key: "ArrowDown" })
        expect(radios[2]).toHaveFocus()
        expect(radios[2]).toHaveAttribute("aria-checked", "true")
        expect(radios.map(radio => radio.tabIndex)).toEqual([-1, -1, 0])
        fireEvent.keyDown(radios[2], { key: "ArrowRight" })
        expect(radios[0]).toHaveFocus()
        expect(radios[0]).toHaveAttribute("aria-checked", "true")
    })

    it("permite ir a los extremos con Home y End y confirmar con espacio", () => {
        render(<Example />)
        const radios = screen.getAllByRole("radio")
        fireEvent.keyDown(radios[0], { key: "End" })
        expect(radios[2]).toHaveFocus()
        fireEvent.keyDown(radios[2], { key: "Home" })
        expect(radios[0]).toHaveFocus()
        fireEvent.keyDown(radios[1], { key: " " })
        expect(radios[1]).toHaveAttribute("aria-checked", "true")
    })

    it("ofrece una entrada por Tab si todavía no hay un valor válido", () => {
        render(<Example initial="unknown" />)
        const radios = screen.getAllByRole("radio")
        expect(radios.map(radio => radio.tabIndex)).toEqual([0, -1, -1])
        fireEvent.keyDown(radios[0], { key: "ArrowLeft" })
        expect(radios[2]).toHaveFocus()
        expect(radios[2]).toHaveAttribute("aria-checked", "true")
    })
})
