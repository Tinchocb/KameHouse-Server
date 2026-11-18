import { fireEvent, render, screen } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { MenuButton } from "./SettingsLayout"

describe("valores del menú del reproductor", () => {
    it("mantiene una sola etiqueta accesible con el último valor durante cambios consecutivos", () => {
        const onClick = vi.fn()
        const view = (value: string) => <LazyMotion features={domAnimation}>
            <MenuButton icon={<span aria-hidden="true">♪</span>} label="Audio" value={value} onClick={onClick} />
        </LazyMotion>
        const { rerender } = render(view("Español"))
        const button = screen.getByRole("button", { name: "Audio Español" })
        button.focus()
        rerender(view("Japonés"))
        rerender(view("Inglés"))
        expect(screen.getByRole("button", { name: "Audio Inglés" })).toBe(button)
        expect(button).toHaveFocus()
        expect(screen.queryByRole("button", { name: /Español|Japonés/ })).toBeNull()
        fireEvent.click(button)
        expect(onClick).toHaveBeenCalledOnce()
    })
})
