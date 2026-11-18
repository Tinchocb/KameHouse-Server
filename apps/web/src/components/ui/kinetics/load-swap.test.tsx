import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { LoadSwap } from "./load-swap"

describe("LoadSwap", () => {
    it("superpone la salida, monta contenido ya disponible y recupera la interacción al invertir", async () => {
        const tree = (loading: boolean) => <LazyMotion features={domAnimation}>
            <LoadSwap loading={loading} skeleton={<button>Cargando biblioteca</button>}>
                <button>Abrir biblioteca</button>
            </LoadSwap>
        </LazyMotion>
        const view = render(tree(true))
        const skeleton = screen.getByRole("button", { name: "Cargando biblioteca" })
        view.rerender(tree(false))
        const content = screen.getByRole("button", { name: "Abrir biblioteca" })
        expect(content.closest("[inert]")).toBeNull()
        expect(skeleton.closest("[inert]")).toHaveStyle({ position: "absolute", pointerEvents: "none" })
        view.rerender(tree(true))
        expect(screen.getByRole("button", { name: "Cargando biblioteca" })).toBe(skeleton)
        expect(skeleton.closest("[inert]")).toBeNull()
        view.rerender(tree(false))
        await waitFor(() => expect(skeleton).not.toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Abrir biblioteca" })).toBe(content)
    })
    beforeEach(() => {
        vi.useRealTimers()
    })

    it("muestra el skeleton mientras loading es true", () => {
        render(
            <LoadSwap
                loading={true}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido real</div>
            </LoadSwap>
        )

        expect(screen.getByTestId("skeleton")).toBeInTheDocument()
        expect(screen.queryByTestId("content")).toBeNull()
    })

    it("monta el contenido en caché directamente sin skeleton ni animación si loading es false desde el inicio", () => {
        render(
            <LoadSwap
                loading={false}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido en caché</div>
            </LoadSwap>
        )

        expect(screen.getByTestId("content")).toBeInTheDocument()
        expect(screen.queryByTestId("skeleton")).toBeNull()
    })

    it("al cambiar loading de true a false, monta el contenido inmediatamente sin esperar la salida del skeleton", () => {
        const { rerender } = render(
            <LoadSwap
                loading={true}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido cargado</div>
            </LoadSwap>
        )

        expect(screen.getByTestId("skeleton")).toBeInTheDocument()
        expect(screen.queryByTestId("content")).toBeNull()

        // Cambiar loading a false
        rerender(
            <LoadSwap
                loading={false}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido cargado</div>
            </LoadSwap>
        )

        // El contenido nuevo se monta en el mismo ciclo (sin esperar que termine el exit del skeleton)
        const contentEl = screen.getByTestId("content")
        expect(contentEl).toBeInTheDocument()

        // Si el skeleton sigue en transición de salida, debe quedar superpuesto e inerte
        const skeletonEl = screen.queryByTestId("skeleton")
        if (skeletonEl) {
            const slot = skeletonEl.closest("[inert]") || skeletonEl.closest(".pointer-events-none")
            expect(slot).not.toBeNull()
        }
    })

    it("soporta cambios rápidos de loading (true -> false -> true -> false)", () => {
        const { rerender } = render(
            <LoadSwap
                loading={true}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido</div>
            </LoadSwap>
        )
        expect(screen.getByTestId("skeleton")).toBeInTheDocument()

        rerender(
            <LoadSwap
                loading={false}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido</div>
            </LoadSwap>
        )
        expect(screen.getByTestId("content")).toBeInTheDocument()

        rerender(
            <LoadSwap
                loading={true}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido</div>
            </LoadSwap>
        )
        expect(screen.getByTestId("skeleton")).toBeInTheDocument()

        rerender(
            <LoadSwap
                loading={false}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido</div>
            </LoadSwap>
        )
        expect(screen.getByTestId("content")).toBeInTheDocument()
    })

    it("respeta ownEntrance sin duplicar entradas", () => {
        render(
            <LoadSwap
                loading={false}
                ownEntrance
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido con animación propia</div>
            </LoadSwap>
        )

        expect(screen.getByTestId("content")).toBeInTheDocument()
    })

    it("desmonta limpiamente sin errores", () => {
        const { unmount } = render(
            <LoadSwap
                loading={true}
                skeleton={<div data-testid="skeleton">Cargando...</div>}
            >
                <div data-testid="content">Contenido</div>
            </LoadSwap>
        )

        expect(() => unmount()).not.toThrow()
    })
})
