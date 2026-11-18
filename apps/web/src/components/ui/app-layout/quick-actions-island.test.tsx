import { render, screen, waitFor } from "@testing-library/react"
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion"
import { describe, expect, it, vi } from "vitest"
import { QuickActionsIsland } from "./quick-actions-island"

const preference = vi.hoisted(() => ({ reduced: false }))
vi.mock("@/components/ui/kinetics/hooks", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/components/ui/kinetics/hooks")>(),
    useReducedMotion: () => preference.reduced,
}))

function view(open: boolean) {
    return <LazyMotion features={domAnimation}>
        <AnimatePresence>{open && <QuickActionsIsland key="quick"><button>Maratón</button></QuickActionsIsland>}</AnimatePresence>
    </LazyMotion>
}

describe("QuickActionsIsland", () => {
    it("bloquea interacción al salir y la recupera si la salida se interrumpe", async () => {
        preference.reduced = false
        const { rerender } = render(view(true))
        const island = screen.getByRole("group", { name: "Acciones rápidas" })
        await waitFor(() => expect(island.style.transform).toBe("none"))
        rerender(view(false))
        expect(island).toHaveAttribute("inert")
        expect(island.style.pointerEvents).toBe("none")
        rerender(view(true))
        expect(screen.getByRole("group", { name: "Acciones rápidas" })).toBe(island)
        expect(island).not.toHaveAttribute("inert")
        expect(island.style.pointerEvents).toBe("auto")
        await waitFor(() => expect(island.style.transform).toBe("none"))
    })

    it("no desplaza la isla al entrar o salir con movimiento reducido", () => {
        preference.reduced = true
        const { rerender } = render(view(true))
        const island = screen.getByRole("group", { name: "Acciones rápidas" })
        expect(island.style.transform).toBe("none")
        rerender(view(false))
        expect(island.style.transform).toBe("none")
        expect(island).toHaveAttribute("inert")
    })
})
