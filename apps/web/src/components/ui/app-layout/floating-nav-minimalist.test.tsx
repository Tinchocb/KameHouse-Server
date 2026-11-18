import type { ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { LazyMotion, domAnimation } from "framer-motion"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FloatingPillNav } from "./floating-pill-nav"
import { useUIStore, usePlayerStore } from "@/lib/store"

vi.mock("@/hooks/use-sound", () => ({
    useSound: () => ({ playSound: vi.fn() }),
}))

const mockNavigate = vi.fn()
vi.mock("@tanstack/react-router", () => ({
    Link: ({ to, children, className, onClick, "aria-current": ariaCurrent, "aria-label": ariaLabel, ...rest }: ComponentPropsWithoutRef<"a"> & { to: string }) => (
        <a
            href={to}
            className={className}
            onClick={(e) => {
                e.preventDefault()
                onClick?.(e)
                mockNavigate(to)
            }}
            aria-current={ariaCurrent}
            aria-label={ariaLabel}
            {...rest}
        >
            {children}
        </a>
    ),
    useRouterState: vi.fn(() => "/home"),
    useNavigate: () => mockNavigate,
}))

let currentWidth = 768
vi.mock("./use-nav-compact", async () => {
    const actual = await vi.importActual<typeof import("./use-nav-compact")>("./use-nav-compact")
    return {
        ...actual,
        useMinWidth: (px: number) => currentWidth >= px,
    }
})

const EMPTY_RESULTS: never[] = []
vi.mock("@/hooks/use-global-search", () => ({
    useGlobalSearch: () => ({
        query: "",
        setQuery: vi.fn(),
        results: EMPTY_RESULTS,
        isLoading: false,
        isSearchActive: false,
    }),
}))

function renderNav() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <LazyMotion features={domAnimation}>
                <FloatingPillNav />
            </LazyMotion>
        </QueryClientProvider>
    )
}

describe("floating-nav-minimalist · regresión de navegación en franja", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        document.documentElement.dataset.uiStyle = "classic-minimalist"
        currentWidth = 768
    })

    afterEach(() => {
        delete document.documentElement.dataset.uiStyle
        currentWidth = 768
    })

    it("entra y sale de pantalla completa sin alterar el orden de hooks", () => {
        renderNav()
        act(() => usePlayerStore.getState().setFullscreen(true))
        expect(screen.queryByRole("banner")).toBeNull()
        act(() => usePlayerStore.getState().setFullscreen(false))
        expect(screen.getByRole("banner", { name: "Navegación principal" })).toBeInTheDocument()
    })

    it("a 768 px y 820 px monta una franja superior sólida sin solapamientos", () => {
        renderNav()
        const banner = screen.getByRole("banner", { name: "Navegación principal" })
        expect(banner).toBeInTheDocument()
        expect(banner.className).toContain("floating-nav-strip")
        expect(banner.className).toContain("justify-between")

        // Tres bloques en layout normal (marca, destinos, herramientas)
        const brandLink = screen.getByRole("link", { name: "KameHouse, ir al inicio" })
        const navGroup = screen.getByRole("navigation", { name: "Destinos principales" })
        const toolsGroup = screen.getByRole("group", { name: "Búsqueda y ajustes" })

        expect(banner).toContainElement(brandLink)
        expect(banner).toContainElement(navGroup)
        expect(banner).toContainElement(toolsGroup)
    })

    it("a 768 px muestra el símbolo y oculta el texto; desde 1024 px muestra el nombre KameHouse", () => {
        // A 768 px
        const { unmount } = renderNav()
        const brandLink768 = screen.getByRole("link", { name: "KameHouse, ir al inicio" })
        expect(brandLink768.querySelector("img")).not.toBeNull()
        expect(brandLink768.textContent).not.toContain("KAMEHOUSE")
        unmount()

        // A 1024 px
        currentWidth = 1024
        renderNav()
        const brandLink1024 = screen.getByRole("link", { name: "KameHouse, ir al inicio" })
        expect(brandLink1024.textContent).toContain("KAMEHOUSE")
    })

    it("mantiene visibles los nombres de todos los destinos a 768 px y 820 px", () => {
        for (const width of [768, 820]) {
            currentWidth = width
            const { unmount } = renderNav()
            const navGroup = screen.getByRole("navigation", { name: "Destinos principales" })

            expect(navGroup).toHaveTextContent("Inicio")
            expect(navGroup).toHaveTextContent("Series")
            expect(navGroup).toHaveTextContent("Películas")
            expect(navGroup).toHaveTextContent("Cronología")
            expect(navGroup).toHaveTextContent("Mi Lista")
            unmount()
        }
    })

    it("garantiza controles con altura mínima accesible de al menos 44 px", () => {
        renderNav()
        const brandLink = screen.getByRole("link", { name: "KameHouse, ir al inicio" })
        expect(brandLink.className).toContain("min-h-[44px]")

        const destinations = screen.getAllByRole("link")
        for (const dest of destinations) {
            expect(dest.className).toContain("min-h-[44px]")
        }

        const queueBtn = screen.getByRole("button", { name: /Mi Lista/ })
        expect(queueBtn.className).toContain("min-h-[44px]")

        const quickActionsTrigger = screen.getByRole("button", { name: "Acciones rápidas" })
        expect(quickActionsTrigger.className).toContain("min-h-[44px]")

        const settingsLink = screen.getByRole("link", { name: "Ajustes" })
        expect(settingsLink.className).toContain("min-h-[44px]")
    })

    it("aplica selección tenue con texto claro (sin pastilla blanca con texto oscuro)", () => {
        renderNav()
        const homeLink = screen.getByRole("link", { name: "Inicio" })
        expect(homeLink).toHaveAttribute("aria-current", "page")
        expect(homeLink.className).toContain("bg-[var(--minimal-fill-3)]")
        expect(homeLink.className).toContain("text-[var(--minimal-text-1)]")
        expect(homeLink.className).not.toContain("text-black")
    })

    it("permite abrir y cerrar Mi Lista alternando el estado global", () => {
        renderNav()
        const queueBtn = screen.getByRole("button", { name: /Mi Lista/ })
        expect(queueBtn).toHaveAttribute("aria-pressed", "false")

        fireEvent.click(queueBtn)
        expect(useUIStore.getState().globalQueueOpen).toBe(true)

        // Limpiar estado
        useUIStore.getState().setGlobalQueueOpen(false)
    })

    it("expande la búsqueda sobre la franja, ocultando e inhabilitando temporalmente los destinos para teclado", () => {
        renderNav()
        const navGroup = screen.getByRole("navigation", { name: "Destinos principales" })
        expect(navGroup).not.toHaveAttribute("aria-hidden")
        expect(navGroup.getAttribute("inert")).toBeNull()

        // Abrir búsqueda
        const searchBtn = screen.getByRole("button", { name: "Buscar" })
        fireEvent.click(searchBtn)

        expect(navGroup).toHaveAttribute("aria-hidden", "true")
        expect(navGroup.getAttribute("inert")).not.toBeNull()

        // Cerrar con Escape devuelve la interacción
        const combobox = screen.getByRole("combobox")
        fireEvent.keyDown(combobox, { key: "Escape" })

        expect(navGroup).not.toHaveAttribute("aria-hidden")
        expect(navGroup.getAttribute("inert")).toBeNull()
        expect(searchBtn).toHaveFocus()
    })
})
