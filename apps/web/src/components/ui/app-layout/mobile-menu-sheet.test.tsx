import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

    afterEach(() => {
        vi.useRealTimers()
    })

    it("ofrece Ajustes, Mi Lista y Sorpréndeme (lo que la barra inferior no tiene)", () => {
        render(<MobileMenuSheet open onOpenChange={() => {}} />)
        expect(screen.getByRole("dialog", { name: "Menú" })).toBeTruthy()
        expect(screen.getByRole("link", { name: "Ajustes" }).getAttribute("href")).toBe("/settings")
        expect(screen.getByRole("button", { name: /Mi Lista/ })).toBeTruthy()
        expect(screen.getByRole("button", { name: "Sorpréndeme" })).toBeTruthy()
    })

    it("el menú se cierra y la cola se abre después del cierre", () => {
        vi.useFakeTimers()
        const onOpenChange = vi.fn()
        render(<MobileMenuSheet open onOpenChange={onOpenChange} />)
        fireEvent.click(screen.getByRole("button", { name: /Mi Lista/ }))
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(useUIStore.getState().globalQueueOpen).toBe(false)
        act(() => {
            vi.advanceTimersByTime(150)
        })
        expect(useUIStore.getState().globalQueueOpen).toBe(true)
    })

    it("el modo aleatorio emite su evento después del cierre", () => {
        vi.useFakeTimers()
        const onEvent = vi.fn()
        window.addEventListener("open-random-picker", onEvent)
        render(<MobileMenuSheet open onOpenChange={() => {}} />)
        fireEvent.click(screen.getByRole("button", { name: "Sorpréndeme" }))
        expect(onEvent).not.toHaveBeenCalled()
        act(() => {
            vi.advanceTimersByTime(150)
        })
        expect(onEvent).toHaveBeenCalledTimes(1)
        window.removeEventListener("open-random-picker", onEvent)
    })
})
