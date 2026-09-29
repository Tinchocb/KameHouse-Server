import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useUIStore } from "@/lib/store"
import { MobileMenuSheet } from "./mobile-menu-sheet"

vi.mock("@tanstack/react-router", () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => <a href={to} {...rest}>{children}</a>,
}))

// El Vaul real trae el tema y el servidor (react-query); acá solo importa el contenido del menú.
vi.mock("@/components/vaul", () => ({
    Vaul: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <>{children}</> : null),
    VaulContent: ({ title, children }: { title?: string; children: React.ReactNode }) => (
        <div role="dialog" aria-label={title}>{children}</div>
    ),
}))

describe("MobileMenuSheet", () => {
    beforeEach(() => {
        useUIStore.getState().setGlobalQueueOpen(false)
    })

    it("ofrece Ajustes, la cola y el modo aleatorio (lo que la barra inferior no tiene)", () => {
        render(<MobileMenuSheet open onOpenChange={() => {}} />)
        expect(screen.getByRole("dialog", { name: "Menú" })).toBeTruthy()
        expect(screen.getByRole("link", { name: "Ajustes" }).getAttribute("href")).toBe("/settings")
        expect(screen.getByRole("button", { name: /Mi lista/ })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Reproducción aleatoria" })).toBeTruthy()
    })

    it("la cola se abre y el menú se cierra", () => {
        const onOpenChange = vi.fn()
        render(<MobileMenuSheet open onOpenChange={onOpenChange} />)
        fireEvent.click(screen.getByRole("button", { name: /Mi lista/ }))
        expect(useUIStore.getState().globalQueueOpen).toBe(true)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("el modo aleatorio emite su evento", () => {
        const onEvent = vi.fn()
        window.addEventListener("open-random-picker", onEvent)
        render(<MobileMenuSheet open onOpenChange={() => {}} />)
        fireEvent.click(screen.getByRole("button", { name: "Reproducción aleatoria" }))
        expect(onEvent).toHaveBeenCalledTimes(1)
        window.removeEventListener("open-random-picker", onEvent)
    })
})
