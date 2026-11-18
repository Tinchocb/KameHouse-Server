import { render, screen, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { describe, expect, it } from "vitest"
import { useFocusTrap } from "./use-focus-trap"

function Dialog({ open }: { open: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    useFocusTrap(ref, open)
    return (
        <>
            <button type="button">Abrir</button>
            {open && (
                <div ref={ref} role="dialog" aria-label="Diálogo">
                    <button type="button">Dentro</button>
                </div>
            )}
        </>
    )
}

describe("useFocusTrap (QA-10)", () => {
    it("lleva el foco dentro del diálogo al abrir", async () => {
        const { rerender } = render(<Dialog open={false} />)
        rerender(<Dialog open />)

        const dialog = screen.getByRole("dialog")
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    })

    it("devuelve el foco a quien lo tenía al cerrar", async () => {
        const { rerender } = render(<Dialog open={false} />)
        const trigger = screen.getByRole("button", { name: "Abrir" })
        trigger.focus()

        rerender(<Dialog open />)
        await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true))

        rerender(<Dialog open={false} />)
        expect(document.activeElement).toBe(trigger)
    })
})
