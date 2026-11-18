import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { PresenceSurface } from "./presence-surface"

describe("superficies salientes", () => {
    it.each([true, false, "true", "false"] as const)("conserva aria-hidden=%s del consumidor al invertir", async hidden => {
        const tree = (open: boolean) => <LazyMotion features={domAnimation}>
            <AnimatePresence initial={false}>{open && <PresenceSurface key="panel" data-testid="panel"
                inert aria-hidden={hidden} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Contenido
            </PresenceSurface>}</AnimatePresence>
        </LazyMotion>
        const view = render(tree(true))
        const panel = screen.getByTestId("panel")
        expect(panel).toHaveAttribute("inert")
        expect(panel).toHaveAttribute("aria-hidden", String(hidden))
        view.rerender(tree(false))
        expect(panel).toHaveAttribute("aria-hidden", "true")
        view.rerender(tree(true))
        await waitFor(() => expect(panel).toHaveAttribute("aria-hidden", String(hidden)))
        expect(panel).toHaveAttribute("inert")
    })
    it("retira interacción y accesibilidad al salir y las recupera al invertir", async () => {
        const onClick = vi.fn()
        const tree = (open: boolean) => <LazyMotion features={domAnimation}>
            <AnimatePresence initial={false}>{open && <PresenceSurface key="panel" initial={{ opacity: 0 }}
                animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <button onClick={onClick}>Elegir</button>
            </PresenceSurface>}</AnimatePresence>
        </LazyMotion>
        const view = render(tree(true))
        const button = screen.getByRole("button", { name: "Elegir" })
        view.rerender(tree(false))
        expect(button.closest("[inert]")).toHaveAttribute("aria-hidden", "true")
        expect(button.closest("[inert]")).toHaveStyle({ pointerEvents: "none" })
        view.rerender(tree(true))
        await waitFor(() => expect(button.closest("[inert]")).toBeNull())
        fireEvent.click(screen.getByRole("button", { name: "Elegir" }))
        expect(onClick).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("button", { name: "Elegir" })).toBe(button)
    })
})
