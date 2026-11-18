import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LazyMotion, domAnimation } from "framer-motion"
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { PlayerSettingsMenu } from "./PlayerSettingsMenu"
import type { AudioTrack, SubtitleTrack } from "./track-types"

function mockViewport(isDesktop: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("min-width") ? isDesktop : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }))
}

const audioTracks = [
    { index: 0, language: "jpn", title: "Japonés" },
    { index: 1, language: "spa", title: "Español" },
] as unknown as AudioTrack[]

const subtitleTracks = [
    { index: 0, language: "spa", title: "Español" },
] as unknown as SubtitleTrack[]

function renderMenu(overrides: Partial<React.ComponentProps<typeof PlayerSettingsMenu>> = {}) {
    const props = {
        audioTracks,
        activeAudioIndex: 0,
        onSelectAudio: vi.fn(),
        subtitleTracks,
        activeSubtitleIndex: null,
        onSelectSubtitle: vi.fn(),
        open: true,
        onOpenChange: vi.fn(),
        ...overrides,
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    queryClient.setQueryData([API_ENDPOINTS.SETTINGS.GetSettings.key], { theme: { themeEnableBlurringEffects: true } })
    const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory({ initialEntries: ["/"] }) })
    render(
        <QueryClientProvider client={queryClient}>
            <RouterContextProvider router={router}><LazyMotion features={domAnimation}><PlayerSettingsMenu {...props} /></LazyMotion></RouterContextProvider>
        </QueryClientProvider>
    )
    return props
}

describe("PlayerSettingsMenu", () => {
    it("retira la interacción de panel y submenú salientes y permite reabrir inmediatamente", async () => {
        renderMenu({ open: undefined })
        const trigger = screen.getByRole("button", { name: "Configuración [O]" })
        fireEvent.click(trigger)
        const dialog = screen.getByRole("dialog")
        const main = dialog.querySelector('[data-settings-view="main"]')
        expect(main).not.toBeNull()
        fireEvent.click(screen.getByRole("button", { name: /^Audio/ }))
        expect(main).toHaveAttribute("inert")
        fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }))
        expect(dialog).toHaveAttribute("inert")
        expect(dialog).toHaveAttribute("aria-hidden", "true")
        fireEvent.click(trigger)
        await waitFor(() => expect(screen.getByRole("dialog")).not.toHaveAttribute("inert"))
        expect(screen.getByRole("dialog")).toBe(dialog)
    })
    beforeEach(() => {
        document.body.removeAttribute("style")
    })

    it("en escritorio no monta hojas ni overlays que bloqueen los clics", () => {
        mockViewport(true)
        renderMenu()
        expect(document.querySelector("[data-vaul-overlay]")).toBeNull()
        expect(document.querySelector("[data-vaul-drawer]")).toBeNull()
        expect(document.body.style.pointerEvents).not.toBe("none")
    })

    it("en escritorio las opciones responden: Audio abre su submenú y selecciona pista", () => {
        mockViewport(true)
        const props = renderMenu()
        fireEvent.click(screen.getByRole("button", { name: /Audio/ }))
        fireEvent.click(screen.getByRole("button", { name: /Español/ }))
        expect(props.onSelectAudio).toHaveBeenCalledWith(audioTracks[1])
    })

    it("en escritorio Subtítulos permite elegir una pista", () => {
        mockViewport(true)
        const props = renderMenu()
        fireEvent.click(screen.getByRole("button", { name: /Subtítulos/ }))
        fireEvent.click(screen.getByRole("button", { name: /Español/ }))
        expect(props.onSelectSubtitle).toHaveBeenCalledWith(subtitleTracks[0])
    })

    it('la fila Subtítulos resume la pista activa sin mostrar el código "und"', () => {
        mockViewport(true)
        renderMenu({
            subtitleTracks: [{ index: 0, language: "und", title: "", codec: "ass" }],
            activeSubtitleIndex: 0,
        })
        const row = screen.getByRole("button", { name: /^Subtítulos/ })
        expect(row).toHaveTextContent("Subtítulos 1")
        expect(row).not.toHaveTextContent(/\bund\b/)
    })

    it('la fila Audio resume la pista activa sin mostrar el código "und"', () => {
        mockViewport(true)
        renderMenu({
            audioTracks: [{ index: 0, language: "und", title: "und" }],
            activeAudioIndex: 0,
        })
        const row = screen.getByRole("button", { name: /^Audio/ })
        expect(row).toHaveTextContent("Audio 1")
        expect(row).not.toHaveTextContent(/\bund\b/)
    })

    it("se monta en panelContainer cuando se provee", () => {
        mockViewport(true)
        const host = document.createElement("div")
        document.body.appendChild(host)
        renderMenu({ panelContainer: host })
        expect(host.textContent).toContain("Configuración")
        host.remove()
    })

    it("variante media: audio y subtítulos en un solo panel, sin submenús", () => {
        mockViewport(true)
        const props = renderMenu({ variant: "media" })
        expect(screen.getByRole("dialog", { name: "Audio y subtítulos" })).toBeInTheDocument()
        const spanish = screen.getAllByRole("button", { name: /Español/ })
        fireEvent.click(spanish[0])
        expect(props.onSelectAudio).toHaveBeenCalledWith(audioTracks[1])
        fireEvent.click(spanish[1])
        expect(props.onSelectSubtitle).toHaveBeenCalledWith(subtitleTracks[0])
    })

    it("variante more: agrupa velocidad y maratón y no repite audio/subtítulos", () => {
        mockViewport(true)
        renderMenu({ variant: "more" })
        expect(screen.getByRole("button", { name: /Velocidad y maratón/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Capítulo anterior/ })).toBeNull()
        expect(screen.queryByRole("button", { name: /Siguiente capítulo/ })).toBeNull()
        expect(screen.queryByRole("button", { name: /^Audio/ })).toBeNull()
    })

    it("Más opciones conserva audio y subtítulos y no expone saltos de tiempo redundantes", () => {
        mockViewport(true)
        renderMenu({ title: "Más opciones" })
        expect(screen.getByRole("dialog", { name: "Más opciones" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Audio/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Subtítulos/ })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Retroceder 10 segundos/ })).toBeNull()
        expect(screen.queryByRole("button", { name: /Adelantar 10 segundos/ })).toBeNull()
    })

    it("cierra el menú antes de abrir Mi lista o entregar la reproducción a mpv", () => {
        mockViewport(true)
        const onOpenQueue = vi.fn()
        const onOpenChange = vi.fn()
        const props = renderMenu({ onOpenQueue, onOpenChange, onOpenInMpv: vi.fn() })
        fireEvent.click(screen.getByRole("button", { name: /Mi lista/ }))
        expect(props.onOpenQueue).toHaveBeenCalledOnce()
        expect(props.onOpenChange).toHaveBeenCalledWith(false)
        expect(onOpenChange.mock.invocationCallOrder[0]).toBeLessThan(onOpenQueue.mock.invocationCallOrder[0])
        fireEvent.click(screen.getByRole("button", { name: /Abrir en mpv/ }))
        expect(props.onOpenInMpv).toHaveBeenCalledOnce()
    })

    it("impide repetir el handoff mientras mpv está abriendo", () => {
        mockViewport(true)
        const props = renderMenu({ onOpenInMpv: vi.fn(), mpvPending: true })
        const button = screen.getByRole("button", { name: "Abriendo en mpv…" })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(props.onOpenInMpv).not.toHaveBeenCalled()
        expect(props.onOpenChange).not.toHaveBeenCalled()
    })

    it("omite las acciones secundarias cuando no se habilitan", () => {
        mockViewport(true)
        renderMenu()
        expect(screen.queryByRole("group", { name: "Acciones de reproducción" })).toBeNull()
        expect(screen.queryByRole("button", { name: /Abrir en mpv/ })).toBeNull()
    })

    it("el nombre del diálogo sigue al título visible y a sus submenús", async () => {
        renderMenu({ title: "Más opciones" })
        expect(await screen.findByRole("dialog", { name: "Más opciones" })).toBeInTheDocument()
        expect(screen.getAllByText("Más opciones", { exact: true })).toHaveLength(1)
        expect(screen.queryByRole("heading", { name: "Detalles" })).toBeNull()

        fireEvent.click(screen.getByRole("button", { name: /^Audio/ }))
        expect(await screen.findByRole("dialog", { name: "Audio" })).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Volver" }))
        expect(await screen.findByRole("dialog", { name: "Más opciones" })).toBeInTheDocument()

        fireEvent.click(screen.getByRole("button", { name: /^Subtítulos/ }))
        expect(await screen.findByRole("dialog", { name: "Subtítulos" })).toBeInTheDocument()
        expect(screen.queryByRole("dialog", { name: "Detalles" })).toBeNull()
    })

    it("al cerrar el menú devuelve el foco al botón que lo abrió", async () => {
        renderMenu({ title: "Más opciones", open: undefined })
        const trigger = screen.getByRole("button", { name: /^Más opciones/ })
        trigger.focus()
        fireEvent.click(trigger)
        await screen.findByRole("dialog", { name: "Más opciones" })
        fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        await waitFor(() => expect(trigger).toHaveFocus())
    })
})
