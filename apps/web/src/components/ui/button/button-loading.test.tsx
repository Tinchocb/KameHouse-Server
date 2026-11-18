import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "./button"
import { IconButton } from "./icon-button"

describe("Button loading layout", () => {
    it.each(["xs", "sm", "md", "lg"] as const)("preserves the label and its layout slot at size %s", size => {
        const { rerender } = render(<Button size={size}>Guardar cambios</Button>)
        const label = screen.getByText("Guardar cambios")
        rerender(<Button size={size} loading>Guardar cambios</Button>)
        const button = screen.getByRole("button", { name: "Guardar cambios" })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute("aria-busy", "true")
        expect(screen.getByText("Guardar cambios")).toBe(label)
        expect(label).toHaveClass("opacity-0")
        expect(button.querySelector("svg")).toHaveClass("absolute", "pointer-events-none")
        expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        rerender(<Button size={size}>Guardar cambios</Button>)
        expect(button).not.toBeDisabled()
        expect(label).not.toHaveClass("opacity-0")
    })

    it("preserves the right icon slot when loading without a left icon", () => {
        const { rerender } = render(<Button rightIcon={<span data-testid="right">→</span>}>Siguiente</Button>)
        const icon = screen.getByTestId("right")
        rerender(<Button loading rightIcon={<span data-testid="right">→</span>}>Siguiente</Button>)
        expect(screen.getByTestId("right")).toBe(icon)
        expect(icon.parentElement).toHaveClass("opacity-0")
    })

    it("keeps the existing spinner slot for icon-only buttons", () => {
        render(<IconButton aria-label="Guardar" icon={<span>✓</span>} loading />)
        expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-busy", "true")
        expect(screen.getByText("✓").parentElement).toHaveClass("invisible")
    })
})
